import { buildUrl } from './config';

export type DeviceRegisterResponse = {
  device_id: string;
  device_token: string;
};

export const registerDevice = async (deviceId: string): Promise<DeviceRegisterResponse> => {
  const res = await fetch(buildUrl('/v1/devices/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Device register failed (${res.status}): ${text || res.statusText}`);
  }

  return (await res.json()) as DeviceRegisterResponse;
};

