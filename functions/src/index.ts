import * as functions from "firebase-functions";

import { Storage } from "@google-cloud/storage";
const gcs = new Storage();
import { tmpdir } from "os";
import { join, dirname, parse } from "path";

import * as sharp from "sharp";
import * as fs from "fs-extra";

export const generateImages = functions.storage
  .object()
  .onFinalize(async (object) => {
    const bucket = gcs.bucket(object.bucket);
    const filePath = object.name || "";
    const fileName = filePath?.split("/").pop() || "null";
    const bucketDir = dirname(filePath);
    const workingDir = join(tmpdir(), "thumbs");
    const tempFilePath = join(workingDir, "source.png");
    const regexForConvertedFiles = /-\d+w/g;
    if (
      regexForConvertedFiles.test(fileName) ||
      !object.contentType?.includes("image")
    ) {
      return false;
    }

    await fs.ensureDir(workingDir);
    await bucket.file(filePath).download({
      destination: tempFilePath,
    });

    const sizes = [320, 640, 960, 1280, 1920, 2560];

    const uploadPromises = sizes.map(async (size) => {
      const thumbName = `${parse(fileName).name}-${size}w${
        parse(fileName).ext
      }`;
      const thumbPath = join(workingDir, thumbName);

      await sharp(tempFilePath).resize(size).toFile(thumbPath);

      return bucket.upload(thumbPath, {
        destination: join(bucketDir, thumbName),
      });
    });

    await Promise.all(uploadPromises);

    return fs.remove(workingDir);
  });
