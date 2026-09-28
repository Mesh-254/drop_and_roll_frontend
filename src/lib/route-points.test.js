import { buildRoutePoints } from "./route-points";

test("builds route points for every job in a full twenty-job response", () => {
  const jobs = Array.from({ length: 20 }, (_, index) => ({
    id: `job-${index + 1}`,
    job_number: index + 1,
    stop_status: "pending",
    stop_address: {
      latitude: 51 + index / 100,
      longitude: -1 - index / 100,
      postal_code: `PC${index + 1}`,
    },
  }));

  const points = buildRoutePoints(jobs);

  expect(points).toHaveLength(20);
  expect(points[19]).toMatchObject({
    lat: 51.19,
    lng: -1.19,
    label: 20,
    postcode: "PC20",
  });
});

test("excludes terminal stops and jobs with missing or invalid coordinates", () => {
  const points = buildRoutePoints([
    {
      stop_status: "pending",
      stop_address: { latitude: 51.5, longitude: -0.1 },
    },
    {
      stop_status: "completed",
      stop_address: { latitude: 51.6, longitude: -0.2 },
    },
    {
      stop_status: "pending",
      stop_address: { latitude: null, longitude: -0.3 },
    },
    {
      stop_status: "pending",
      stop_address: { latitude: "not-a-coordinate", longitude: -0.4 },
    },
    {
      stop_status: "pending",
      stop_address: { latitude: " ", longitude: -0.5 },
    },
  ]);

  expect(points).toHaveLength(1);
  expect(points[0]).toMatchObject({ lat: 51.5, lng: -0.1 });
});
