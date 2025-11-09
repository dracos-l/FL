// index.js (ES module for Node 22) — use @aws-sdk/client-s3 (v3)
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Buffer } from "buffer";

const s3 = new S3Client({});

/**
 * streamToString: handles Buffer or stream bodies from S3 getObject
 */
async function streamToString(body) {
  if (!body) return "";
  // If Lambda returns a Body that's already a Buffer or string
  if (Buffer.isBuffer(body)) return body.toString("utf8");
  // Otherwise it's a stream
  const chunks = [];
  for await (const chunk of body) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export const handler = async (event) => {
  // Amplify usually sets STORAGE_<resource>_BUCKET for S3 resources; use that if present.
  const BUCKET = process.env.STORAGE_JSONSTORAGE_BUCKET || process.env.S3_BUCKET;
  if (!BUCKET) {
    console.error("Bucket env var not set. Check function configuration for STORAGE_<resourcename>_BUCKET or set S3_BUCKET.");
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Bucket env var not configured" }),
    };
  }

  const KEY = "data/db.json"; // object key (adjust if you used a different path)
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS,DELETE",
    "Content-Type": "application/json",
  };

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    if (event.httpMethod === "GET") {
      try {
        const getRes = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }));
        const txt = await streamToString(getRes.Body);
        const data = txt ? JSON.parse(txt) : {};
        return { statusCode: 200, headers, body: JSON.stringify(data) };
      } catch (err) {
        // If object not found, return empty object
        const code = err?.name || err?.Code || err?.$metadata?.httpStatusCode;
        if (err && /NoSuchKey|NotFound|404/i.test(String(err.name || err.code || err.$metadata?.httpStatusCode))) {
          return { statusCode: 200, headers, body: JSON.stringify({}) };
        }
        console.error("S3 GET error:", err);
        throw err;
      }
    }

    if (event.httpMethod === "POST" || event.httpMethod === "PUT") {
      const payload = event.body ? JSON.parse(event.body) : {};

      // Read existing
      let current = {};
      try {
        const getRes = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }));
        const txt = await streamToString(getRes.Body);
        current = txt ? JSON.parse(txt) : {};
      } catch (err) {
        if (!(err && /NoSuchKey|NotFound|404/i.test(String(err.name || err.code)))) {
          console.warn("Error reading S3 object (non-missing):", err);
        }
        // else start with {}
      }

      // Merge strategy (shallow). Modify if you need append behavior.
      const next = { ...current, ...payload };

      // Put back
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: KEY,
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