import driverApi from "./driver-api";

afterEach(() => {
  jest.restoreAllMocks();
});

test("getAllAssignedJobs requests 50 at a time and returns all pages", async () => {
  const firstPageJobs = Array.from({ length: 50 }, (_, index) => ({
    id: `job-${index + 1}`,
    stop_id: `stop-${index + 1}`,
  }));
  const secondPageJobs = [
    { id: "job-50", stop_id: "stop-50" },
    { id: "job-51", stop_id: "stop-51" },
  ];
  const getAssignedJobs = jest
    .spyOn(driverApi, "getAssignedJobs")
    .mockResolvedValueOnce({
      ordered_bookings: firstPageJobs,
      count: 51,
      route_id: "route-1",
    })
    .mockResolvedValueOnce({
      ordered_bookings: secondPageJobs,
      count: 51,
      route_id: "route-1",
    });

  const response = await driverApi.getAllAssignedJobs("all");

  expect(getAssignedJobs.mock.calls).toEqual([
    [1, 50, "all"],
    [2, 50, "all"],
  ]);
  expect(response.count).toBe(51);
  expect(response.route_id).toBe("route-1");
  expect(response.ordered_bookings).toHaveLength(51);
  expect(response.ordered_bookings[50].id).toBe("job-51");
});

test("one page includes more than the map's former ten-job request", async () => {
  const jobs = Array.from({ length: 20 }, (_, index) => ({
    id: `job-${index + 1}`,
    stop_id: `stop-${index + 1}`,
  }));
  const getAssignedJobs = jest
    .spyOn(driverApi, "getAssignedJobs")
    .mockResolvedValueOnce({ ordered_bookings: jobs, count: 20 });

  const response = await driverApi.getAllAssignedJobs("all");

  expect(getAssignedJobs).toHaveBeenCalledTimes(1);
  expect(getAssignedJobs).toHaveBeenCalledWith(1, 50, "all");
  expect(response.ordered_bookings).toHaveLength(20);
});
