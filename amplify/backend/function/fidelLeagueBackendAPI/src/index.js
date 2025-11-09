// index.js (ESM) - @aws-sdk/client-s3
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Buffer } from "buffer";

const s3 = new S3Client({});

async function streamToString(body) {
  if (!body) return "";
  if (Buffer.isBuffer(body)) return body.toString("utf8");
  const chunks = [];
  for await (const chunk of body) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export const handler = async (event) => {
  const BUCKET = process.env.STORAGE_JSONSTORAGE_BUCKET || process.env.S3_BUCKET;
  if (!BUCKET) {
    console.error("No bucket env var set");
    return { statusCode: 500, body: JSON.stringify({ error: "Bucket not configured" }) };
  }
  const KEY = "data/db.json";
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS,DELETE",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  try {
    if (event.httpMethod === "GET") {
      try {
        const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }));
        const txt = await streamToString(res.Body);
        return { statusCode: 200, headers, body: JSON.stringify(txt ? JSON.parse(txt) : {}) };
      } catch (err) {
        if (err?.name && /NoSuchKey|NotFound|404/i.test(err.name)) {
          return { statusCode: 200, headers, body: JSON.stringify({}) };
        }
        throw err;
      }
    }

    if (event.httpMethod === "POST" || event.httpMethod === "PUT") {
      const payload = event.body ? JSON.parse(event.body) : {};
      let current = {};
      try {
        const existing = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }));
        const txt = await streamToString(existing.Body);
        current = txt ? JSON.parse(txt) : {};
      } catch (err) {
        if (!(err?.name && /NoSuchKey|NotFound|404/i.test(err.name))) console.warn("S3 read error", err);
      }
      const next = { ...current, ...payload };
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET, Key: KEY,
        Body: JSON.stringify(next, null, 2),
        ContentType: "application/json"
      }));
      return { statusCode: 200, headers, body: JSON.stringify(next) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ message: "Method Not Allowed" }) };
  } catch (err) {
    console.error("Handler error:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || String(err) }) };
  }
};