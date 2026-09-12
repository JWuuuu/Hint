import { expect, it } from "vitest";
import { buildProviderPayload } from "./astrologyApiClient";
const input = { birthday: "2000-01-01", birthTime: "00:00", birthCity: "London", latitude: 51.5072, longitude: -0.1276, timezone: 0 };
it("preserves actual zero offsets and midnight without guessing missing birth fields", () => {
  expect(buildProviderPayload(input)).toMatchObject({ hour: 0, min: 0, tzone: 0 });
  expect(buildProviderPayload({ ...input, birthTime: undefined })).toBeNull();
  expect(buildProviderPayload({ ...input, birthTime: "25:00" })).toBeNull();
  expect(buildProviderPayload({ ...input, latitude: undefined })).toBeNull();
  expect(buildProviderPayload({ ...input, timezone: undefined })).toBeNull();
  expect(buildProviderPayload({ ...input, timezone: " " })).toBeNull();
});
it("uses the birth instant's zone offset and refuses nonexistent or ambiguous local times", () => {
  expect(buildProviderPayload({ ...input, timezone: "Europe/London" })).toMatchObject({ tzone: 0 });
  expect(buildProviderPayload({ ...input, birthday: "2024-07-01", timezone: "America/New_York" })).toMatchObject({ tzone: -4 });
  expect(buildProviderPayload({ ...input, birthday: "2024-03-10", birthTime: "02:30", timezone: "America/New_York" })).toBeNull();
  expect(buildProviderPayload({ ...input, birthday: "2024-11-03", birthTime: "01:30", timezone: "America/New_York" })).toBeNull();
});
