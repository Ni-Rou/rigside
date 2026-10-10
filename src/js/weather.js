"use strict";

/* Weather for your location from Open-Meteo (free, no key, works anywhere): right now, when rain's
   due (from the 15-minute forecast), the next 24 hours, 7 days, sunrise/sunset and air quality.
   It refreshes every 15 min while the window's visible. The last result is kept in localStorage so
   everything fills in straight away at start-up. Sends an RS "weather" event with the result. */
const RS_WEATHER = (() => {
  const URL = "https://api.open-meteo.com/v1/forecast";
  const AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
  const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
  const EVERY_MS = 15 * 60 * 1000;
  const WET_MM = 0.1; // per 15 min; below this counts as dry
  const KEY = "rs-weather";

  // WMO weather code -> [description, icon]. After dark the "-day" icons swap for their "-night" ones.
  const WMO = {
    0: ["Clear", "clear-day"],
    1: ["Mostly clear", "partly-day"],
    2: ["Partly cloudy", "partly-day"],
    3: ["Overcast", "cloud"],
    45: ["Fog", "fog"],
    48: ["Freezing fog", "fog"],
    51: ["Light drizzle", "drizzle"],
    53: ["Drizzle", "drizzle"],
    55: ["Heavy drizzle", "drizzle"],
    56: ["Freezing drizzle", "sleet"],
    57: ["Freezing drizzle", "sleet"],
    61: ["Light rain", "rain"],
    63: ["Rain", "rain"],
    65: ["Heavy rain", "heavy-rain"],
    66: ["Freezing rain", "sleet"],
    67: ["Freezing rain", "sleet"],
    71: ["Light snow", "snow"],
    73: ["Snow", "snow"],
    75: ["Heavy snow", "snow"],
    77: ["Snow grains", "snow"],
    80: ["Light showers", "showers-day"],
    81: ["Showers", "showers-day"],
    82: ["Heavy showers", "heavy-rain"],
    85: ["Snow showers", "snow"],
    86: ["Heavy snow showers", "snow"],
    95: ["Thunderstorm", "thunder"],
    96: ["Thunder and hail", "thunder"],
    99: ["Thunder and hail", "thunder"],
  };
  const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const compass = (deg) => (deg == null ? "" : COMPASS[Math.round(deg / 45) % 8]);
  const round = (v, d = 0) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
  const hhmm = (iso) => (iso ? iso.slice(11, 16) : null);
  function describe(code, isDay = true) {
    let [desc, icon] = WMO[code] || ["–", "cloud"];
    if (icon.endsWith("-day") && !isDay) icon = icon.replace("-day", "-night");
    return { desc, icon };
  }

  let data = null; // parsed weather
  let fetchedAt = 0;
  let error = null;
  let busy = false;
  let again = false; // a forced fetch asked for while one was running

  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved) {
      data = saved.data;
      fetchedAt = saved.at;
    }
  } catch {
    /* storage unavailable */
  }

  function locKey(s) {
    return s.location ? `${s.location.lat.toFixed(3)},${s.location.lon.toFixed(3)},${s.temp_unit},${s.wind_unit}` : "";
  }

  // "Rain from 14:15" / "Rain until 15:30" / "Dry for the next 6 h", from 15-minute precipitation.
  function rainLine(m15, nowIso) {
    const times = m15?.time || [],
      p = m15?.precipitation || [];
    let start = times.findIndex((t) => t.slice(0, 16) > nowIso);
    if (start < 0) return { text: "", wet_now: false };
    start = Math.max(0, start - 1); // the slot we're inside
    const slots = times.slice(start).map((t, i) => [t, p[start + i] || 0]);
    if (!slots.length) return { text: "", wet_now: false };
    const hours = Math.round((slots.length * 15) / 60);
    const wet = slots.map(([, v]) => v >= WET_MM);
    if (wet[0]) {
      for (let i = 1; i < slots.length - 1; i++)
        if (!wet[i] && !wet[i + 1]) return { text: `Rain until ${hhmm(slots[i][0])}`, wet_now: true };
      return { text: `Rain for the next ${hours} h`, wet_now: true };
    }
    const i = wet.indexOf(true);
    if (i >= 0) return { text: `Rain from ${hhmm(slots[i][0])}`, wet_now: false, from: slots[i][0] };
    return { text: `Dry for the next ${hours} h`, wet_now: false };
  }

  function parse(p, air) {
    const cur = p.current,
      h = p.hourly,
      d = p.daily || {};
    // Open-Meteo gives times local to the location (timezone=auto), so work out "now" there
    const nowIso = cur.time.slice(0, 16);
    const isDay = !!cur.is_day;
    const now = describe(cur.weather_code, isDay);
    const next = h.time.findIndex((t) => t > nowIso.slice(0, 13) + ":00");
    const start = next >= 0 ? next : Math.max(0, h.time.length - 24);
    const hours24 = [];
    for (let i = start; i < Math.min(start + 24, h.time.length); i++) {
      const w = describe(h.weather_code[i], !!h.is_day[i]);
      hours24.push({
        time: h.time[i],
        temp: round(h.temperature_2m[i]),
        icon: w.icon,
        desc: w.desc,
        pop: h.precipitation_probability?.[i] ?? null,
        precip: round(h.precipitation?.[i], 1),
        wind: round(h.wind_speed_10m?.[i]),
        gust: round(h.wind_gusts_10m?.[i]),
        dir: compass(h.wind_direction_10m?.[i]),
      });
    }
    const days = (d.time || []).map((date, i) => {
      const w = describe(d.weather_code?.[i]);
      return {
        date,
        icon: w.icon,
        desc: w.desc,
        max: round(d.temperature_2m_max?.[i]),
        min: round(d.temperature_2m_min?.[i]),
        pop: d.precipitation_probability_max?.[i] ?? null,
        precip: round(d.precipitation_sum?.[i], 1),
        wind: round(d.wind_speed_10m_max?.[i]),
        gust: round(d.wind_gusts_10m_max?.[i]),
        dir: compass(d.wind_direction_10m_dominant?.[i]),
        uv: round(d.uv_index_max?.[i], 1),
        sunrise: hhmm(d.sunrise?.[i]),
        sunset: hhmm(d.sunset?.[i]),
        daylight_s: d.daylight_duration?.[i] ? Math.round(d.daylight_duration[i]) : null,
      };
    });
    const today = days.find((x) => x.date === nowIso.slice(0, 10)) || days[0] || {};
    let aq = null;
    if (air?.current) {
      const c = air.current;
      aq = { eaqi: round(c.european_aqi), usaqi: round(c.us_aqi), pm25: round(c.pm2_5, 1) };
    }
    return {
      place: null,
      tz: p.timezone,
      utc_offset_s: p.utc_offset_seconds,
      local_now: nowIso,
      now: {
        temp: round(cur.temperature_2m),
        feels: round(cur.apparent_temperature),
        desc: now.desc,
        icon: now.icon,
        is_day: isDay,
        wind: round(cur.wind_speed_10m),
        gust: round(cur.wind_gusts_10m),
        wind_from: compass(cur.wind_direction_10m),
        humidity: cur.relative_humidity_2m,
        pressure: round(cur.pressure_msl),
        uv: round(cur.uv_index, 1),
        visibility_km: cur.visibility != null ? round(cur.visibility / 1000, 1) : null,
        code: cur.weather_code,
      },
      today: { max: today.max, min: today.min, sunrise: today.sunrise, sunset: today.sunset },
      hours: hours24.slice(0, 6),
      hours24,
      days,
      rain: rainLine(p.minutely_15, nowIso),
      air: aq,
    };
  }

  async function fetchNow(force = false) {
    const s = RS.settings();
    if (busy && force) again = true;
    if (!s.location || busy || document.hidden) return;
    const key = locKey(s);
    if (!force && data && data.key === key && Date.now() - fetchedAt < EVERY_MS) return;
    busy = true;
    try {
      const q = new URLSearchParams({
        latitude: s.location.lat,
        longitude: s.location.lon,
        timezone: "auto",
        forecast_days: 7,
        forecast_minutely_15: 24,
        temperature_unit: s.temp_unit === "f" ? "fahrenheit" : "celsius",
        wind_speed_unit: s.wind_unit === "kmh" ? "kmh" : s.wind_unit === "ms" ? "ms" : "mph",
        current:
          "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,is_day,relative_humidity_2m,pressure_msl,uv_index,visibility",
        hourly:
          "temperature_2m,precipitation_probability,precipitation,weather_code,is_day,wind_speed_10m,wind_gusts_10m,wind_direction_10m",
        minutely_15: "precipitation",
        daily:
          "sunrise,sunset,temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,uv_index_max,daylight_duration",
      });
      const aq = new URLSearchParams({
        latitude: s.location.lat,
        longitude: s.location.lon,
        current: "european_aqi,us_aqi,pm2_5",
        timezone: "auto",
      });
      const [r, a] = await Promise.all([fetch(`${URL}?${q}`), fetch(`${AIR_URL}?${aq}`).catch(() => null)]);
      if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
      const air = a && a.ok ? await a.json() : null;
      data = { ...parse(await r.json(), air), key };
      fetchedAt = Date.now();
      error = null;
      try {
        localStorage.setItem(KEY, JSON.stringify({ data, at: fetchedAt }));
      } catch {
        /* storage unavailable */
      }
    } catch (e) {
      error = String(e.message || e);
      console.warn("weather", e);
    } finally {
      busy = false;
    }
    RS.emit("weather", snapshot());
    if (again) {
      again = false;
      fetchNow(true);
    }
  }

  function snapshot() {
    const s = RS.settings();
    const valid = data && data.key === locKey(s);
    return {
      data: valid ? data : null,
      fetched_at: fetchedAt,
      stale: Date.now() - fetchedAt > 2 * EVERY_MS,
      error,
      configured: !!s.location,
    };
  }

  async function search(name) {
    const q = new URLSearchParams({
      name,
      count: 8,
      language: navigator.language?.slice(0, 2) || "en",
      format: "json",
    });
    const r = await fetch(`${GEO_URL}?${q}`);
    if (!r.ok) throw new Error(`Search failed (${r.status})`);
    const j = await r.json();
    return (j.results || []).map((x) => ({
      name: x.name,
      admin: x.admin1 || "",
      country: x.country || x.country_code || "",
      lat: x.latitude,
      lon: x.longitude,
    }));
  }

  RS.on("ready", () => {
    RS.emit("weather", snapshot());
    fetchNow();
    setInterval(fetchNow, 60 * 1000); // cheap check; only fetches when 15 min old
  });
  RS.on("visible", (v) => {
    if (v) fetchNow();
  });
  let lastKey = "";
  RS.on("settings", (s) => {
    const k = locKey(s);
    if (k !== lastKey) {
      lastKey = k;
      RS.emit("weather", snapshot());
      fetchNow(true);
    }
  });
  RS.on("ready", (s) => {
    lastKey = locKey(s);
  });

  return { search };
})();
