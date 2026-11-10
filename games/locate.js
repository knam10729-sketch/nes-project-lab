export const GEO_ERRORS = {
  1: "위치 권한을 허용하지 않았습니다. 브라우저의 사이트 설정에서 위치를 허용하고, 휴대폰의 위치(GPS)를 켜 주세요.",
  2: "지금 위치를 받지 못했습니다. 휴대폰의 위치를 켠 뒤 다시 누르거나, 지도에서 장소를 고르세요.",
  3: "위치를 제때 받지 못했습니다. 잠시 후 다시 누르거나, 지도에서 장소를 고르세요.",
};

const DEFAULT_ATTEMPTS = [
  { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
  { enableHighAccuracy: false, timeout: 10000, maximumAge: 15000 },
];

export function locate(geolocation, { attempts = DEFAULT_ATTEMPTS } = {}) {
  if (!geolocation || typeof geolocation.getCurrentPosition !== "function") {
    return Promise.reject(geoError(2));
  }
  return new Promise((resolve, reject) => {
    let index = 0;
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const succeed = (position) => {
      if (settled) return;
      settled = true;
      resolve(position);
    };
    const next = () => {
      if (settled) return;
      if (index >= attempts.length) {
        finish(geoError(3));
        return;
      }
      const options = attempts[index];
      index += 1;
      let done = false;
      const timer = setTimeout(() => {
        if (done || settled) return;
        done = true;
        if (index < attempts.length) next();
        else finish(geoError(3));
      }, Number(options.timeout) + 800);
      try {
        geolocation.getCurrentPosition(
          (position) => {
            if (done || settled) return;
            done = true;
            clearTimeout(timer);
            succeed(position);
          },
          (error) => {
            if (done || settled) return;
            done = true;
            clearTimeout(timer);
            if (error?.code === 1) finish(geoError(1));
            else next();
          },
          options,
        );
      } catch {
        clearTimeout(timer);
        finish(geoError(2));
      }
    };
    next();
  });
}

function geoError(code) {
  return Object.assign(new Error(GEO_ERRORS[code] || GEO_ERRORS[2]), { code });
}
