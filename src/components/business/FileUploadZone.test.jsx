/* eslint-env jest */
// The upload zone's client-side pre-check.
//
// The server has always been authoritative and still is. The point of checking
// here is that a missing column should not cost a 10 MB upload and a round trip
// to find out — and when it does fail, it must say WHICH column, because
// "invalid file" sends the customer back to a spreadsheet with fifteen columns
// and no idea which one is wrong.
//
// CSV only, deliberately: parsing .xlsx in the browser would mean shipping a
// spreadsheet library to every visitor to catch something the server already
// catches. Better to check nothing than to check it wrongly.

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

jest.mock("framer-motion", () => ({
  __esModule: true,
  AnimatePresence: ({ children }) => children,
  motion: new Proxy(
    {},
    {
      get:
        (_t, tag) =>
        ({ children, ...props }) => {
          const React = require("react");
          for (const k of ["whileHover", "whileTap", "initial", "animate", "transition", "exit", "variants", "layout"]) {
            delete props[k];
          }
          return React.createElement(String(tag), props, children);
        },
    },
  ),
}));

import FileUploadZone from "./FileUploadZone";

const HEADERS = [
  "reference",
  "pickup_postal_code",
  "pickup_address_line1",
  "dropoff_postal_code",
  "dropoff_address_line1",
  "dropoff_phone",
  "receiver_name",
  "leave_safe_spot",
  "weight_kg",
  "num_parcels",
  "service_type_name",
];

function csvFile(headers = HEADERS, rows = 1, name = "batch.csv") {
  const body = [headers.join(",")];
  for (let i = 0; i < rows; i += 1) body.push(headers.map(() => "x").join(","));
  const file = new File([body.join("\n")], name, { type: "text/csv" });
  // jsdom's File has no .text() in this version; the component slices then reads.
  file.slice = () => ({ text: async () => body.join("\n") });
  return file;
}

async function choose(file) {
  const onFileSelect = jest.fn();
  const { container } = render(<FileUploadZone onFileSelect={onFileSelect} />);
  const input = container.querySelector('input[type="file"]');
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
  return onFileSelect;
}

test("a valid file is accepted", async () => {
  const onFileSelect = await choose(csvFile());
  await waitFor(() => expect(onFileSelect).toHaveBeenCalled());
});

test("a missing column is named, not reported as 'invalid file'", async () => {
  const without = HEADERS.filter((h) => h !== "dropoff_phone");
  const onFileSelect = await choose(csvFile(without));

  expect(await screen.findByText(/dropoff_phone/)).toBeInTheDocument();
  expect(onFileSelect).not.toHaveBeenCalled();
});

test("several missing columns are all named", async () => {
  const without = HEADERS.filter((h) => !["dropoff_phone", "weight_kg"].includes(h));
  await choose(csvFile(without));

  const msg = await screen.findByText(/dropoff_phone/);
  expect(msg.textContent).toMatch(/weight_kg/);
});

test("too many rows is refused before uploading", async () => {
  const onFileSelect = await choose(csvFile(HEADERS, 1001));

  expect(await screen.findByText(/maximum is 1000/i)).toBeInTheDocument();
  expect(onFileSelect).not.toHaveBeenCalled();
});

test("an empty file is refused with a reason", async () => {
  const file = new File([""], "empty.csv", { type: "text/csv" });
  file.slice = () => ({ text: async () => "" });
  const onFileSelect = await choose(file);

  expect(await screen.findByText(/empty/i)).toBeInTheDocument();
  expect(onFileSelect).not.toHaveBeenCalled();
});

test("an xlsx file skips the content check rather than guessing at it", async () => {
  const file = new File(["binary"], "batch.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const onFileSelect = await choose(file);

  await waitFor(() => expect(onFileSelect).toHaveBeenCalled());
});

test("a wrong file type is still refused", async () => {
  const file = new File(["x"], "notes.txt", { type: "text/plain" });
  const onFileSelect = await choose(file);

  expect(await screen.findByText(/Invalid file type/i)).toBeInTheDocument();
  expect(onFileSelect).not.toHaveBeenCalled();
});
