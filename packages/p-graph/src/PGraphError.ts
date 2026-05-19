/**
 * Error thrown if PGraph task execution fails.
 * Contains the original errors thrown by the tasks.
 *
 * (For validation failures outside of task execution, `p-graph` will throw a regular `Error`.)
 */
export class PGraphError extends Error {
  constructor(public readonly taskErrors: unknown[]) {
    super(
      "Error(s) occurred during task execution:\n" +
        taskErrors.map((e) => `- ${String(e)}`).join("\n"),
    );
  }
}
