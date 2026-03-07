import { removeBackground, Config } from "@imgly/background-removal";

/**
 * Removes the background from an image file using @imgly/background-removal.
 * @param file The original image file
 * @returns A new File object (usually PNG) with the background removed
 */
export const removeImageBackground = async (file: File): Promise<File> => {
    const config: Config = {
        progress: (status, progress) => {
            // progress can be used to update UI if needed
            // console.log(`Background removal: ${status} (${Math.round(progress * 100)}%)`);
        },
        output: {
            format: "image/png",
            quality: 0.8
        }
    };

    try {
        const resultBlob = await removeBackground(file, config);

        // Create a new File object from the blob
        // We use PNG because background removal usually results in transparency
        const newFileName = file.name.replace(/\.[^/.]+$/, "") + "_no_bg.png";

        return new File([resultBlob], newFileName, {
            type: "image/png",
            lastModified: new Date().getTime()
        });
    } catch (error) {
        console.error("Background removal error:", error);
        throw new Error("Failed to remove background from image.");
    }
};
