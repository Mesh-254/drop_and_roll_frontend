/* eslint-env jest */
// Step 3 of the wizard — Review & Confirm — after the two stacked questions
// became one.
//
// It used to ask "a new batch or corrections to an earlier upload?" and then,
// directly underneath, "skip the rows you already booked or book them again?".
// The second restates the first one's answer, and the two could be answered
// inconsistently.
//
// Pinned here: the merged question reaches the wizard, gates Submit, and turns
// into the right request body. The rules themselves live in confirmChoice.test.js
// and the rendering in ConfirmUploadChoice.test.jsx; this is the wiring between
// them.

import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

jest.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => jest.fn(),
}));

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

const mockListCorrectable = jest.fn();
jest.mock("../../api/BulkUploadApi", () => ({
  __esModule: true,
  default: {
    listCorrectable: (...a) => mockListCorrectable(...a),
    downloadTemplate: jest.fn(),
  },
}));

import BulkUploadFlow from "./BulkUploadFlow";

const CORRECTABLE = [
  { id: "b1", batch_name: "March Week 2", failed: 30, label: "March Week 2 · 30 failed · 11 Aug 2026" },
];

const startUpload = jest.fn();

function hookWith(validation) {
  return {
    selectedFile: { name: "batch.csv" },
    validationResult: validation,
    isValidating: false,
    validateFile: jest.fn(),
    isUploading: false,
    startUpload,
    latestUpload: null,
    isPolling: false,
    isAutoNavQueued: false,
    isWaitingForReceivable: false,
    manualContinueToPayment: jest.fn(),
    manualViewInvoice: jest.fn(),
    uploadError: null,
    reset: jest.fn(),
  };
}

/** Render and walk to the confirm step: file → batch details → confirm.
 *  The hook already carries a validationResult, which is the real state after
 *  the drop-zone validated the file. */
async function atConfirmStep(validation) {
  render(<BulkUploadFlow hook={hookWith(validation)} />);

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /^Continue/i }));
  });
  fireEvent.change(screen.getByPlaceholderText(/March Week 2 Deliveries/i), {
    target: { value: "March Week 3" },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /validate & continue/i }));
  });

  // By ROLE: "Review & Confirm" is also a step label in the indicator above.
  await screen.findByRole("heading", { name: /Review & Confirm/i });
}

const CLEAN = { valid_rows: 43, error_count: 0, computed_total: "392.97", duplicate_count: 0 };
const DIRTY = {
  ...CLEAN,
  duplicate_count: 14,
  duplicate_rows: [{ row_number: 7, reference: "VALID-STD-02", matched_by: "reference" }],
  duplicate_matched_upload: { id: "b1", batch_name: "March Week 2" },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockListCorrectable.mockResolvedValue({ results: CORRECTABLE });
  startUpload.mockResolvedValue(undefined);
});

test("the confirm step asks one question, not two", async () => {
  await atConfirmStep(DIRTY);

  expect(screen.getByText(/what is this upload\?/i)).toBeInTheDocument();
  // The old second question, verbatim from the screenshot that prompted this.
  expect(screen.queryByRole("radio", { name: /skip them/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("radio", { name: /book them again/i })).not.toBeInTheDocument();
});

test("already-booked rows block Submit until the question is answered", async () => {
  await atConfirmStep(DIRTY);

  const submit = () => screen.getByRole("button", { name: /submit batch/i });
  expect(submit()).toBeDisabled();

  fireEvent.click(screen.getByRole("radio", { name: /a new batch/i }));

  expect(submit()).toBeEnabled();
});

test("a new batch over duplicates books them again, explicitly", async () => {
  await atConfirmStep(DIRTY);

  fireEvent.click(screen.getByRole("radio", { name: /a new batch/i }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /submit batch/i }));
  });

  expect(startUpload).toHaveBeenCalledWith({ duplicatePolicy: "book_again" });
});

test("corrections send the parent batch and no policy", async () => {
  await atConfirmStep(DIRTY);
  await waitFor(() => expect(mockListCorrectable).toHaveBeenCalled());

  fireEvent.click(screen.getByRole("radio", { name: /corrections/i }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /submit batch/i }));
  });

  expect(startUpload).toHaveBeenCalledWith({ correctsUpload: "b1" });
});

test("a clean file submits in one click and sends no policy", async () => {
  await atConfirmStep(CLEAN);

  const submit = screen.getByRole("button", { name: /submit batch/i });
  expect(submit).toBeEnabled();
  await act(async () => {
    fireEvent.click(submit);
  });

  expect(startUpload).toHaveBeenCalledWith({});
});

test("corrections wait for a batch when none can be preselected", async () => {
  mockListCorrectable.mockResolvedValue({ results: [] });
  await atConfirmStep(DIRTY);
  await waitFor(() => expect(mockListCorrectable).toHaveBeenCalled());

  fireEvent.click(screen.getByRole("radio", { name: /corrections/i }));

  // "Corrections to nothing" is not a declaration.
  expect(screen.getByRole("button", { name: /submit batch/i })).toBeDisabled();
});

test("a picker outage never blocks an ordinary upload", async () => {
  // Overwhelmingly the common case. The list is a convenience; failing to load
  // it must not stop a new batch going out.
  mockListCorrectable.mockRejectedValue(new Error("down"));
  await atConfirmStep(CLEAN);
  await waitFor(() => expect(mockListCorrectable).toHaveBeenCalled());

  expect(screen.getByRole("button", { name: /submit batch/i })).toBeEnabled();
});
