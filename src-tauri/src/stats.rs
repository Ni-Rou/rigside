//! PC stats, read when something asks for them (nothing runs if no window wants them).
//!
//! - CPU, RAM, drives, network and uptime: sysinfo, no admin needed.
//! - NVIDIA GPU: NVML from the driver (nvml.dll). Other GPUs don't have it, so it's skipped.
//! - Temperatures: Windows has no way to read the CPU temperature without admin, so we borrow them
//!   from LibreHardwareMonitor's web server (127.0.0.1:8085) or HWiNFO's shared memory if you're
//!   running one of them. Rigside doesn't ship a kernel driver, which keeps anti-cheat happy.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use nvml_wrapper::enum_wrappers::device::{TemperatureSensor, TemperatureThreshold};
use nvml_wrapper::Nvml;
use serde::Serialize;
use serde_json::Value;
use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, Networks, RefreshKind, System};

use crate::hwinfo;

const MIN_SAMPLE: Duration = Duration::from_millis(900);
const SENSOR_EVERY: Duration = Duration::from_secs(2);
const LHM_URL: &str = "http://127.0.0.1:8085/data.json";

#[derive(Serialize, Clone, Default)]
pub struct Gpu {
    name: String,
    load: Option<u32>,
    temp: Option<f32>,
    temp_max: Option<f32>,
    vram_used_mb: Option<u64>,
    vram_total_mb: Option<u64>,
    power_w: Option<f32>,
    fan: Option<u32>,
}

#[derive(Serialize, Clone)]
pub struct DiskInfo {
    name: String,
    used_gb: f64,
    total_gb: f64,
}

#[derive(Serialize, Clone, Default)]
pub struct Stats {
    cpu_name: String,
    cpu_load: f32,
    cpu_temp: Option<f32>,
    cores: usize,
    ram_used_gb: f64,
    ram_total_gb: f64,
    gpu: Option<Gpu>,
    disks: Vec<DiskInfo>,
    net_down_bps: u64,
    net_up_bps: u64,
    uptime_s: u64,
    /// "lhm", "hwinfo" or null: where the temperatures came from.
    sensors: Option<&'static str>,
}

struct Sampler {
    sys: System,
    disks: Disks,
    nets: Networks,
    nvml: Option<Nvml>,
    last: Option<Instant>,
    last_sensors: Option<Instant>,
    sensors: Sensors,
    stats: Stats,
}

#[derive(Default, Clone)]
struct Sensors {
    source: Option<&'static str>,
    cpu_temp: Option<f32>,
    gpu_temp: Option<f32>,
    gpu_load: Option<f32>,
    gpu_name: Option<String>,
}

static SAMPLER: Mutex<Option<Sampler>> = Mutex::new(None);

fn gb(bytes: u64) -> f64 {
    (bytes as f64 / 1_073_741_824.0 * 10.0).round() / 10.0
}

impl Sampler {
    fn new() -> Self {
        let sys = System::new_with_specifics(
            RefreshKind::nothing()
                .with_cpu(CpuRefreshKind::nothing().with_cpu_usage())
                .with_memory(MemoryRefreshKind::nothing().with_ram()),
        );
        Sampler {
            sys,
            disks: Disks::new_with_refreshed_list(),
            nets: Networks::new_with_refreshed_list(),
            nvml: Nvml::init().ok(),
            last: None,
            last_sensors: None,
            sensors: Sensors::default(),
            stats: Stats::default(),
        }
    }

    fn sample(&mut self) -> Stats {
        let now = Instant::now();
        if self.last.is_some_and(|t| now - t < MIN_SAMPLE) {
            return self.stats.clone();
        }
        let elapsed = self.last.map(|t| (now - t).as_secs_f64()).unwrap_or(1.0).max(0.1);
        self.last = Some(now);

        self.sys.refresh_cpu_usage();
        self.sys.refresh_memory();
        self.nets.refresh(true);
        let (down, up) = self
            .nets
            .iter()
            .filter(|(name, _)| !name.to_lowercase().contains("loopback"))
            .fold((0u64, 0u64), |(d, u), (_, n)| (d + n.received(), u + n.transmitted()));

        if self.last_sensors.is_none_or(|t| now - t >= SENSOR_EVERY) {
            self.last_sensors = Some(now);
            self.disks.refresh(true);
            self.sensors = read_sensors();
        }

        let cpu_name = self
            .sys
            .cpus()
            .first()
            .map(|c| c.brand().trim().to_string())
            .unwrap_or_default();
        let disks = self
            .disks
            .iter()
            .filter(|d| !d.is_removable() && d.total_space() > 1_000_000_000)
            .map(|d| DiskInfo {
                name: d.mount_point().to_string_lossy().trim_end_matches('\\').to_string(),
                used_gb: gb(d.total_space() - d.available_space()),
                total_gb: gb(d.total_space()),
            })
            .collect();

        let mut gpu = self.nvml.as_ref().and_then(nvidia);
        let s = &self.sensors;
        match gpu.as_mut() {
            Some(g) => {
                if g.temp.is_none() {
                    g.temp = s.gpu_temp;
                }
            }
            None if s.gpu_temp.is_some() || s.gpu_load.is_some() => {
                gpu = Some(Gpu {
                    name: s.gpu_name.clone().unwrap_or_else(|| "GPU".into()),
                    load: s.gpu_load.map(|l| l.round() as u32),
                    temp: s.gpu_temp,
                    ..Default::default()
                });
            }
            None => {}
        }

        self.stats = Stats {
            cpu_name,
            cpu_load: (self.sys.global_cpu_usage() * 10.0).round() / 10.0,
            cpu_temp: s.cpu_temp,
            cores: self.sys.cpus().len(),
            ram_used_gb: gb(self.sys.used_memory()),
            ram_total_gb: gb(self.sys.total_memory()),
            gpu,
            disks,
            net_down_bps: (down as f64 / elapsed) as u64,
            net_up_bps: (up as f64 / elapsed) as u64,
            uptime_s: System::uptime(),
            sensors: s.source,
        };
        self.stats.clone()
    }
}

fn nvidia(nvml: &Nvml) -> Option<Gpu> {
    let d = nvml.device_by_index(0).ok()?;
    let mem = d.memory_info().ok();
    Some(Gpu {
        name: d.name().unwrap_or_else(|_| "NVIDIA GPU".into()).replace("NVIDIA ", ""),
        load: d.utilization_rates().ok().map(|u| u.gpu),
        temp: d.temperature(TemperatureSensor::Gpu).ok().map(|t| t as f32),
        temp_max: d
            .temperature_threshold(TemperatureThreshold::Slowdown)
            .ok()
            .map(|t| t as f32),
        vram_used_mb: mem.as_ref().map(|m| m.used / 1_048_576),
        vram_total_mb: mem.as_ref().map(|m| m.total / 1_048_576),
        power_w: d.power_usage().ok().map(|mw| (mw as f32 / 100.0).round() / 10.0),
        fan: d.fan_speed(0).ok(),
    })
}

// Sensors from LibreHardwareMonitor or HWiNFO

const CPU_TEMP_NAMES: [&str; 5] = ["Core (Tctl/Tdie)", "Tctl/Tdie", "CPU Package", "Package", "Core (Tctl)"];

fn read_sensors() -> Sensors {
    if let Some(s) = lhm() {
        return s;
    }
    if let Some(s) = hwinfo::read() {
        return Sensors {
            source: Some("hwinfo"),
            cpu_temp: s.cpu_temp,
            gpu_temp: s.gpu_temp,
            gpu_load: s.gpu_load,
            gpu_name: s.gpu_name,
        };
    }
    Sensors::default()
}

/// Graphics built into the CPU, as LibreHardwareMonitor and HWiNFO name them. If there's a proper
/// graphics card as well, that's the one to show.
pub fn looks_integrated(name: &str) -> bool {
    let n = name.to_lowercase();
    let n = n.trim();
    let has_digit = n.chars().any(|c| c.is_ascii_digit());
    // laptop APU names like "780M"
    let apu_model = n
        .split_whitespace()
        .any(|w| w.len() >= 4 && w.ends_with('m') && w[..w.len() - 1].chars().all(|c| c.is_ascii_digit()));
    n.contains("uhd graphics")
        || n.contains("hd graphics")
        || n.contains("iris")
        || n.contains("vega")
        || (n.ends_with("graphics") && !has_digit)
        || apu_model
}

fn walk<'a>(node: &'a Value, out: &mut Vec<&'a Value>) {
    out.push(node);
    if let Some(children) = node.get("Children").and_then(Value::as_array) {
        for c in children {
            walk(c, out);
        }
    }
}

fn num(v: &Value) -> Option<f32> {
    let s = v.as_str()?;
    let cleaned: String = s
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.' || *c == ',' || *c == '-')
        .collect();
    cleaned.replace(',', ".").parse().ok()
}

fn lhm() -> Option<Sensors> {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_millis(500)))
        .build()
        .into();
    let tree: Value = agent.get(LHM_URL).call().ok()?.body_mut().read_json().ok()?;
    Some(parse_lhm(&tree))
}

/// Find the CPU temperature and the GPU temperature and load in LibreHardwareMonitor's data.json.
fn parse_lhm(tree: &Value) -> Sensors {
    let mut s = Sensors {
        source: Some("lhm"),
        ..Default::default()
    };
    let mut all = Vec::new();
    walk(tree, &mut all);
    // (name, temperature, load) per GPU; the one to show is picked after the walk
    let mut gpus: Vec<(String, Option<f32>, Option<f32>)> = Vec::new();
    for hw in all {
        let image = hw.get("ImageURL").and_then(Value::as_str).unwrap_or("").to_lowercase();
        let is_cpu = image.contains("cpu");
        let is_gpu = image.contains("nvidia")
            || image.contains("ati")
            || image.contains("amd")
            || image.contains("intel") && image.contains("gpu");
        if !is_cpu && !is_gpu {
            continue;
        }
        let mut sensors = Vec::new();
        walk(hw, &mut sensors);
        let temps: Vec<(&str, f32)> = sensors
            .iter()
            .filter(|n| {
                n.get("SensorId")
                    .and_then(Value::as_str)
                    .is_some_and(|id| id.contains("/temperature/"))
            })
            .filter_map(|n| Some((n.get("Text")?.as_str()?, num(n.get("Value")?)?)))
            .collect();
        if is_cpu && s.cpu_temp.is_none() {
            s.cpu_temp = CPU_TEMP_NAMES
                .iter()
                .find_map(|want| temps.iter().find(|(name, _)| name == want).map(|(_, v)| *v))
                .or_else(|| temps.iter().map(|(_, v)| *v).reduce(f32::max));
        }
        if is_gpu && !is_cpu {
            let name = hw.get("Text").and_then(Value::as_str).unwrap_or("GPU").to_string();
            let temp = temps
                .iter()
                .find(|(n, _)| n.contains("Core") || n.contains("GPU"))
                .or(temps.first())
                .map(|(_, v)| *v);
            let load = sensors
                .iter()
                .filter(|n| {
                    n.get("SensorId")
                        .and_then(Value::as_str)
                        .is_some_and(|id| id.contains("/load/"))
                })
                .find(|n| {
                    n.get("Text")
                        .and_then(Value::as_str)
                        .is_some_and(|t| t.contains("Core") || t.contains("D3D 3D"))
                })
                .and_then(|n| num(n.get("Value")?));
            if temp.is_some() || load.is_some() {
                gpus.push((name, temp, load));
            }
        }
    }
    let pick = gpus
        .iter()
        .position(|(n, _, _)| !looks_integrated(n))
        .or(if gpus.is_empty() { None } else { Some(0) });
    if let Some(i) = pick {
        let (name, temp, load) = gpus.swap_remove(i);
        (s.gpu_name, s.gpu_temp, s.gpu_load) = (Some(name), temp, load);
    }
    s
}

pub fn get() -> Stats {
    let mut guard = crate::lock(&SAMPLER);
    guard.get_or_insert_with(Sampler::new).sample()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn num_reads_lhm_values() {
        assert_eq!(num(&json!("45.5 °C")), Some(45.5));
        assert_eq!(num(&json!("12,5 %")), Some(12.5));
        assert_eq!(num(&json!("-")), None);
        assert_eq!(num(&json!(3)), None);
    }

    fn sensor(id: &str, text: &str, value: &str) -> Value {
        json!({ "SensorId": id, "Text": text, "Value": value, "Children": [] })
    }

    #[test]
    fn parse_lhm_finds_cpu_and_gpu() {
        let tree = json!({ "Text": "Sensor", "Children": [{ "Text": "MAIN", "Children": [
            { "Text": "AMD Ryzen 7 9800X3D", "ImageURL": "images_icon/cpu.png", "Children": [
                { "Text": "Temperatures", "Children": [
                    sensor("/amdcpu/0/temperature/3", "Core (CCD1)", "61.0 °C"),
                    sensor("/amdcpu/0/temperature/2", "Core (Tctl/Tdie)", "68.4 °C"),
                ]},
            ]},
            { "Text": "NVIDIA GeForce RTX 4070", "ImageURL": "images_icon/nvidia.png", "Children": [
                { "Text": "Temperatures", "Children": [ sensor("/gpu-nvidia/0/temperature/0", "GPU Core", "55.0 °C") ]},
                { "Text": "Load", "Children": [
                    sensor("/gpu-nvidia/0/load/1", "GPU Memory", "20.0 %"),
                    sensor("/gpu-nvidia/0/load/0", "GPU Core", "37.0 %"),
                ]},
            ]},
        ]}]});
        let s = parse_lhm(&tree);
        assert_eq!(s.source, Some("lhm"));
        assert_eq!(s.cpu_temp, Some(68.4), "prefers Tctl/Tdie over a single CCD");
        assert_eq!(s.gpu_temp, Some(55.0));
        assert_eq!(s.gpu_load, Some(37.0));
        assert_eq!(s.gpu_name.as_deref(), Some("NVIDIA GeForce RTX 4070"));
    }

    #[test]
    fn parse_lhm_falls_back_to_hottest_cpu_sensor() {
        let tree = json!({ "Children": [{ "Text": "Intel Core i5", "ImageURL": "cpu.png", "Children": [
            sensor("/intelcpu/0/temperature/0", "CPU Core #1", "50 °C"),
            sensor("/intelcpu/0/temperature/1", "CPU Core #2", "57 °C"),
        ]}]});
        assert_eq!(parse_lhm(&tree).cpu_temp, Some(57.0));
    }

    #[test]
    fn integrated_graphics_are_recognised() {
        for n in [
            "AMD Radeon(TM) Graphics",
            "AMD Radeon 780M Graphics",
            "Intel(R) UHD Graphics 770",
            "Intel(R) Iris(R) Xe Graphics",
            "Intel(R) Arc(TM) Graphics",
            "AMD Radeon Vega 8 Graphics",
        ] {
            assert!(looks_integrated(n), "{n}");
        }
        for n in [
            "NVIDIA GeForce RTX 4070",
            "AMD Radeon RX 7800 XT",
            "Intel(R) Arc(TM) A770 Graphics",
            "GeForce GTX 1660",
        ] {
            assert!(!looks_integrated(n), "{n}");
        }
    }

    #[test]
    fn parse_lhm_prefers_the_dedicated_card() {
        let tree = json!({ "Children": [
            { "Text": "AMD Radeon(TM) Graphics", "ImageURL": "ati.png", "Children": [
                sensor("/gpu-amd/1/temperature/0", "GPU Core", "40 °C"),
                sensor("/gpu-amd/1/load/0", "GPU Core", "2 %"),
            ]},
            { "Text": "AMD Radeon RX 7800 XT", "ImageURL": "ati.png", "Children": [
                sensor("/gpu-amd/0/temperature/0", "GPU Core", "71 °C"),
                sensor("/gpu-amd/0/load/0", "GPU Core", "96 %"),
            ]},
        ]});
        let s = parse_lhm(&tree);
        assert_eq!(s.gpu_name.as_deref(), Some("AMD Radeon RX 7800 XT"));
        assert_eq!((s.gpu_temp, s.gpu_load), (Some(71.0), Some(96.0)));
    }

    #[test]
    fn parse_lhm_uses_integrated_graphics_when_alone() {
        let tree = json!({ "Children": [{ "Text": "AMD Radeon(TM) Graphics", "ImageURL": "ati.png", "Children": [
            sensor("/gpu-amd/0/load/0", "GPU Core", "12 %"),
        ]}]});
        assert_eq!(parse_lhm(&tree).gpu_load, Some(12.0));
    }

    #[test]
    fn parse_lhm_empty_tree() {
        let s = parse_lhm(&json!({}));
        assert!(s.cpu_temp.is_none() && s.gpu_temp.is_none() && s.gpu_load.is_none());
    }
}
