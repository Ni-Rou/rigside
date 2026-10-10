//! Volume, mute, mic mute and switching the output device.
//!
//! Switching goes through IPolicyConfig. It's undocumented, but it's what the Windows sound settings use
//! and it hasn't changed since Windows 7 (pycaw, SoundSwitch and EarTrumpet use it too). It sets the
//! default for all three roles at once.

#![allow(non_snake_case)] // IPolicyConfig keeps its COM method names

use serde::Serialize;
use windows::core::{interface, IUnknown, IUnknown_Vtbl, GUID, HRESULT, PCWSTR, PWSTR};
use windows::Win32::Devices::FunctionDiscovery::PKEY_Device_FriendlyName;
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::Media::Audio::{
    eCapture, eCommunications, eConsole, eMultimedia, eRender, ERole, IMMDevice, IMMDeviceEnumerator,
    MMDeviceEnumerator, PKEY_AudioEndpoint_FormFactor, DEVICE_STATE_ACTIVE,
};
use windows::Win32::System::Com::{CoCreateInstance, CoTaskMemFree, CLSCTX_ALL, STGM_READ};

use crate::com;

#[derive(Serialize)]
pub struct Output {
    id: String,
    name: String,
    /// Windows says it's headphones or a headset (endpoint form factor).
    headset: bool,
}

#[derive(Serialize)]
pub struct Audio {
    volume: u32,
    muted: bool,
    /// None when there is no microphone.
    mic_muted: Option<bool>,
    output_id: String,
    output: String,
    output_headset: bool,
    outputs: Vec<Output>,
}

#[interface("f8679f50-850a-41cf-9c72-430f290290c8")]
unsafe trait IPolicyConfig: IUnknown {
    fn GetMixFormat(&self, a: PCWSTR, b: *mut *mut core::ffi::c_void) -> HRESULT;
    fn GetDeviceFormat(&self, a: PCWSTR, b: i32, c: *mut *mut core::ffi::c_void) -> HRESULT;
    fn ResetDeviceFormat(&self, a: PCWSTR) -> HRESULT;
    fn SetDeviceFormat(&self, a: PCWSTR, b: *mut core::ffi::c_void, c: *mut core::ffi::c_void) -> HRESULT;
    fn GetProcessingPeriod(&self, a: PCWSTR, b: i32, c: *mut i64, d: *mut i64) -> HRESULT;
    fn SetProcessingPeriod(&self, a: PCWSTR, b: *mut i64) -> HRESULT;
    fn GetShareMode(&self, a: PCWSTR, b: *mut core::ffi::c_void) -> HRESULT;
    fn SetShareMode(&self, a: PCWSTR, b: *mut core::ffi::c_void) -> HRESULT;
    fn GetPropertyValue(&self, a: PCWSTR, b: *const core::ffi::c_void, c: *mut core::ffi::c_void) -> HRESULT;
    fn SetPropertyValue(&self, a: PCWSTR, b: *const core::ffi::c_void, c: *mut core::ffi::c_void) -> HRESULT;
    fn SetDefaultEndpoint(&self, id: PCWSTR, role: ERole) -> HRESULT;
    fn SetEndpointVisibility(&self, id: PCWSTR, visible: i32) -> HRESULT;
}

const CLSID_POLICY_CONFIG: GUID = GUID::from_u128(0x870af99c_171d_4f9e_af0d_e63df40c2bc9);

fn enumerator() -> windows::core::Result<IMMDeviceEnumerator> {
    unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) }
}

pub(crate) fn device_id(dev: &IMMDevice) -> windows::core::Result<String> {
    unsafe {
        let p: PWSTR = dev.GetId()?;
        let s = p.to_string().unwrap_or_default();
        CoTaskMemFree(Some(p.0 as *const _));
        Ok(s)
    }
}

fn device_name(dev: &IMMDevice) -> String {
    unsafe {
        dev.OpenPropertyStore(STGM_READ)
            .and_then(|store| store.GetValue(&PKEY_Device_FriendlyName))
            .map(|v| v.to_string())
            .unwrap_or_default()
    }
}

fn is_headset(dev: &IMMDevice) -> bool {
    const HEADPHONES: u32 = 3;
    const HEADSET: u32 = 5;
    unsafe {
        dev.OpenPropertyStore(STGM_READ)
            .and_then(|store| store.GetValue(&PKEY_AudioEndpoint_FormFactor))
            .and_then(|v| u32::try_from(&v))
            .map(|f| f == HEADPHONES || f == HEADSET)
            .unwrap_or(false)
    }
}

fn endpoint_volume(dev: &IMMDevice) -> windows::core::Result<IAudioEndpointVolume> {
    unsafe { dev.Activate(CLSCTX_ALL, None) }
}

fn state() -> windows::core::Result<Audio> {
    let en = enumerator()?;
    unsafe {
        let out = en.GetDefaultAudioEndpoint(eRender, eMultimedia)?;
        let vol = endpoint_volume(&out)?;
        let volume = (vol.GetMasterVolumeLevelScalar()? * 100.0).round() as u32;
        let muted = vol.GetMute()?.as_bool();
        let mic_muted = en
            .GetDefaultAudioEndpoint(eCapture, eCommunications)
            .and_then(|m| endpoint_volume(&m))
            .and_then(|v| v.GetMute())
            .map(|b| b.as_bool())
            .ok();
        let col = en.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)?;
        let mut outputs = Vec::new();
        for i in 0..col.GetCount()? {
            let d = col.Item(i)?;
            outputs.push(Output {
                id: device_id(&d)?,
                name: device_name(&d),
                headset: is_headset(&d),
            });
        }
        Ok(Audio {
            volume,
            muted,
            mic_muted,
            output_id: device_id(&out)?,
            output: device_name(&out),
            output_headset: is_headset(&out),
            outputs,
        })
    }
}

pub fn get() -> Result<Audio, String> {
    com::run(|| state().map_err(com::err))
}

fn default_out_volume() -> windows::core::Result<IAudioEndpointVolume> {
    unsafe { endpoint_volume(&enumerator()?.GetDefaultAudioEndpoint(eRender, eMultimedia)?) }
}

fn do_set_volume(level: u32) -> windows::core::Result<Audio> {
    let vol = default_out_volume()?;
    unsafe {
        vol.SetMasterVolumeLevelScalar(level.min(100) as f32 / 100.0, std::ptr::null())?;
        if level > 0 && vol.GetMute()?.as_bool() {
            vol.SetMute(false, std::ptr::null())?;
        }
    }
    state()
}

fn do_toggle_mute() -> windows::core::Result<Audio> {
    let vol = default_out_volume()?;
    unsafe { vol.SetMute(!vol.GetMute()?.as_bool(), std::ptr::null())? };
    state()
}

fn do_toggle_mic() -> windows::core::Result<Audio> {
    let en = enumerator()?;
    unsafe {
        // Mute both the communications and the console default (often the same device).
        let comms = en.GetDefaultAudioEndpoint(eCapture, eCommunications)?;
        let now = endpoint_volume(&comms)?.GetMute()?.as_bool();
        for role in [eCommunications, eConsole] {
            if let Ok(d) = en.GetDefaultAudioEndpoint(eCapture, role) {
                endpoint_volume(&d)?.SetMute(!now, std::ptr::null())?;
            }
        }
    }
    state()
}

fn do_set_output(id: &str) -> windows::core::Result<Audio> {
    let wide: Vec<u16> = id.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        let policy: IPolicyConfig = CoCreateInstance(&CLSID_POLICY_CONFIG, None, CLSCTX_ALL)?;
        for role in [eConsole, eMultimedia, eCommunications] {
            policy.SetDefaultEndpoint(PCWSTR(wide.as_ptr()), role).ok()?;
        }
    }
    state()
}

pub fn set_volume(level: u32) -> Result<Audio, String> {
    com::run(move || do_set_volume(level).map_err(com::err))
}

pub fn toggle_mute() -> Result<Audio, String> {
    com::run(|| do_toggle_mute().map_err(com::err))
}

pub fn toggle_mic() -> Result<Audio, String> {
    com::run(|| do_toggle_mic().map_err(com::err))
}

pub fn set_output(id: String) -> Result<Audio, String> {
    com::run(move || do_set_output(&id).map_err(com::err))
}
