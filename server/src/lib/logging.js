const writeLine = (stream, message) => {
  stream.write(`${message}\n`);
};

export const logInfo = (message) => {
  if (process.env.NODE_ENV === "test") return;
  writeLine(process.stdout, message);
};

export const logError = (message) => {
  writeLine(process.stderr, message);
};
