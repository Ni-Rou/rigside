//! Sensors from HWiNFO's shared memory. You have to turn on "Shared Memory Support" in HWiNFO.
//!
//! The layout comes from HWiNFO's SDK header (HWiNFO_SENSORS_SHARED_MEM2, packed):
//! header: signature u32, version u32, revision u32, poll_time i64,
//!         sensor_offset u32, sensor_size u32, sensor_count u32,
//!         reading_offset u32, reading_size u32, reading_count u32
//! reading: type u32, sensor_index u32, reading_id u32, label_orig [128], label_user [128],
//!          unit [16], value f64, min f64, max f64, avg f64
//! sensor:  id u32, instance u32, name_orig [128], name_user [128]

use windows::core::w;
use windows::Win32::Foundation::CloseHandle;
use windows::Win32::System::Memory::{
    MapViewOfFile, OpenFileMappingW, UnmapViewOfFile, VirtualQuery, FILE_MAP_READ, MEMORY_BASIC_INFORMATION,
};

pub struct HwInfo {
    pub cpu_temp: Option<f32>,
    pub gpu_temp: Option<f32>,
    pub gpu_load: Option<f32>,
    pub gpu_name: Option<String>,
}

const TYPE_TEMP: u32 = 1;
const TYPE_USAGE: u32 = 7;
const CPU_NAMES: [&str; 4] = ["CPU (Tctl/Tdie)", "CPU Package", "CPU Die (average)", "Core Max"];

fn u32_at(b: &[u8], off: usize) -> Option<u32> {
    Some(u32::from_le_bytes(b.get(off..off + 4)?.try_into().ok()?))
}

fn f64_at(b: &[u8], off: usize) -> Option<f64> {
    Some(f64::from_le_bytes(b.get(off..off + 8)?.try_into().ok()?))
}

fn text_at(b: &[u8], off: usize, len: usize) -> String {
    let raw = b.get(off..off + len).unwrap_or(&[]);
    let end = raw.iter().position(|&c| c == 0).unwrap_or(raw.len());
    String::from_utf8_lossy(&raw[..end]).into_owned()
}

fn gpu_entry(
    gpus: &mut Vec<(usize, Option<f32>, Option<f32>)>,
    sensor: usize,
) -> &mut (usize, Option<f32>, Option<f32>) {
    let i = gpus.iter().position(|g| g.0 == sensor).unwrap_or_else(|| {
        gpus.push((sensor, None, None));
        gpus.len() - 1
    });
    &mut gpus[i]
}

/// HWiNFO names GPU sensor blocks like "GPU [#0]: AMD Radeon RX 7800 XT: ..."; take the model.
fn gpu_name(block: &str) -> String {
    let parts: Vec<&str> = block.split(':').map(str::trim).filter(|p| !p.is_empty()).collect();
    parts.get(1).or(parts.last()).map(|p| p.to_string()).unwrap_or_default()
}

pub fn read() -> Option<HwInfo> {
    unsafe {
        let handle = OpenFileMappingW(FILE_MAP_READ.0, false, w!("Global\\HWiNFO_SENS_SM2")).ok()?;
        let view = MapViewOfFile(handle, FILE_MAP_READ, 0, 0, 0);
        if view.Value.is_null() {
            let _ = CloseHandle(handle);
            return None;
        }
        let base = view.Value as *const u8;
        // Never trust the header's sizes beyond what is actually mapped.
        let mut info = MEMORY_BASIC_INFORMATION::default();
        let mapped = if VirtualQuery(
            Some(view.Value),
            &mut info,
            std::mem::size_of::<MEMORY_BASIC_INFORMATION>(),
        ) == 0
        {
            0
        } else {
            info.RegionSize
        };
        if mapped < 44 {
            let _ = UnmapViewOfFile(view);
            let _ = CloseHandle(handle);
            return None;
        }
        let head = std::slice::from_raw_parts(base, 44);
        let result = (|| {
            let sensor_off = u32_at(head, 20)? as usize;
            let sensor_size = u32_at(head, 24)? as usize;
            let sensor_count = u32_at(head, 28)? as usize;
            let read_off = u32_at(head, 32)? as usize;
            let read_size = u32_at(head, 36)? as usize;
            let read_count = u32_at(head, 40)? as usize;
            if read_size < 316 || read_count > 10_000 || sensor_count > 1_000 {
                return None;
            }
            let total = (read_off + read_size * read_count).max(sensor_off + sensor_size * sensor_count);
            if total > mapped {
                return None;
            }
            let all = std::slice::from_raw_parts(base, total);
            let sensor_name = |i: usize| text_at(all, sensor_off + i * sensor_size + 8, 128);

            let mut out = HwInfo {
                cpu_temp: None,
                gpu_temp: None,
                gpu_load: None,
                gpu_name: None,
            };
            let mut cpu_best: Option<(usize, f32)> = None; // (rank in CPU_NAMES, value)
                                                           // one entry per GPU sensor block (sensor index, temperature, load), so a GPU's temp and load
                                                           // always come from the same card
            let mut gpus: Vec<(usize, Option<f32>, Option<f32>)> = Vec::new();
            for i in 0..read_count {
                let r = read_off + i * read_size;
                let kind = u32_at(all, r)?;
                let sensor = u32_at(all, r + 4)? as usize;
                let label = text_at(all, r + 12, 128);
                let value = f64_at(all, r + 284)? as f32;
                if kind == TYPE_TEMP {
                    if let Some(rank) = CPU_NAMES.iter().position(|n| label == *n) {
                        if cpu_best.is_none_or(|(best, _)| rank < best) {
                            cpu_best = Some((rank, value));
                        }
                    }
                    if label == "GPU Temperature" {
                        gpu_entry(&mut gpus, sensor).1.get_or_insert(value);
                    }
                } else if kind == TYPE_USAGE && (label == "GPU Core Load" || label == "GPU Utilization") {
                    gpu_entry(&mut gpus, sensor).2.get_or_insert(value);
                }
            }
            out.cpu_temp = cpu_best.map(|(_, v)| v);
            let pick = gpus
                .iter()
                .position(|g| !crate::stats::looks_integrated(&gpu_name(&sensor_name(g.0))))
                .or(if gpus.is_empty() { None } else { Some(0) });
            if let Some(i) = pick {
                let (sensor, temp, load) = gpus[i];
                out.gpu_name = Some(gpu_name(&sensor_name(sensor)));
                out.gpu_temp = temp;
                out.gpu_load = load;
            }
            Some(out)
        })();
        let _ = UnmapViewOfFile(view);
        let _ = CloseHandle(handle);
        result.filter(|h| h.cpu_temp.is_some() || h.gpu_temp.is_some())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn readers_stay_in_bounds() {
        let b = [1u8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xf0, 0x3f];
        assert_eq!(u32_at(&b, 0), Some(1));
        assert_eq!(u32_at(&b, 10), None);
        assert_eq!(f64_at(&b, 4), Some(1.0));
        assert_eq!(f64_at(&b, 5), None);
    }

    #[test]
    fn gpu_names_from_hwinfo_blocks() {
        assert_eq!(gpu_name("GPU [#0]: AMD Radeon RX 7800 XT: "), "AMD Radeon RX 7800 XT");
        assert_eq!(gpu_name("GPU [#1]: AMD Radeon(TM) Graphics"), "AMD Radeon(TM) Graphics");
        assert_eq!(gpu_name("NVIDIA GeForce RTX 4070"), "NVIDIA GeForce RTX 4070");
    }

    #[test]
    fn text_stops_at_nul_and_survives_bad_ranges() {
        let b = b"CPU Package\0\0junk";
        assert_eq!(text_at(b, 0, 16), "CPU Package");
        assert_eq!(text_at(b, 100, 8), "");
    }
}
