import fs from "node:fs";
import { pipeline } from "node:stream/promises";
import { Writable, Readable } from "node:stream";
import csv from "csv-parser";

/**
 * Async generator transform that strips UTF-8 BOM (\uFEFF) only at the very start of the stream.
 * @param {AsyncIterable<string>} source
 */
async function* stripBom(source) {
  let isFirstChunk = true;
  for await (const chunk of source) {
    if (isFirstChunk) {
      if (chunk.length === 0) {
        continue;
      }
      isFirstChunk = false;
      if (typeof chunk === "string" && chunk.charCodeAt(0) === 0xfeff) {
        const remaining = chunk.slice(1);
        if (remaining.length > 0) {
          yield remaining;
        }
        continue;
      }
    }
    yield chunk;
  }
}

/**
 * Parses a CSV stream into an array of row objects.
 * @param {Readable} readableStream
 * @returns {Promise<Array<Record<string, string>>>}
 */
export async function parseContributionCSVStream(readableStream) {
  const rows = [];
  const collector = new Writable({
    objectMode: true,
    write(chunk, encoding, callback) {
      rows.push(chunk);
      callback();
    }
  });

  await pipeline(
    readableStream,
    stripBom,
    csv({
      separator: ",",
      quote: '"',
      escape: '"',
      mapHeaders: ({ header }) => header.replace(/^\ufeff/, ""),
      trim: true
    }),
    collector
  );

  return rows;
}

/**
 * Parses a CSV file at `filePath` into an array of row objects.
 * Handles both plain UTF-8 and UTF-8 BOM encoding.
 * @param {string} filePath - Absolute or relative path to CSV file
 * @returns {Promise<Array<Record<string, string>>>}
 */
export async function parseContributionCSV(filePath) {
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  return parseContributionCSVStream(stream);
}

/**
 * Parses a CSV in-memory Buffer into an array of row objects.
 * Handles both plain UTF-8 and UTF-8 BOM encoding.
 * @param {Buffer} buffer - In-memory CSV Buffer
 * @returns {Promise<Array<Record<string, string>>>}
 */
export async function parseContributionCSVBuffer(buffer) {
  const text = buffer.toString("utf8");
  const stream = Readable.from(text);
  return parseContributionCSVStream(stream);
}
