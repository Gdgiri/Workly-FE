/**
 * Cloudinary Upload Utility
 * Uses signed uploads for testing purposes as per user request.
 * SECURITY NOTE: Exposing API Secret in frontend is for testing ONLY.
 */

async function generateSignature(params: Record<string, any>, apiSecret: string) {
    // 1. Filter out empty/undefined/null parameters
    const filteredParams = Object.keys(params)
        .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
        .reduce((acc, key) => {
            acc[key] = params[key];
            return acc;
        }, {} as Record<string, any>);

    // 2. Sort parameters alphabetically
    const keys = Object.keys(filteredParams).sort();

    // 3. Create the string to sign
    const binner = keys
        .map(key => `${key}=${filteredParams[key]}`)
        .join('&');

    const stringToSign = `${binner}${apiSecret}`;

    // 4. Hash with SHA-1
    const encoder = new TextEncoder();
    const data = encoder.encode(stringToSign);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);

    // 5. Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
}

export const uploadToCloudinary = async (file: File | Blob, resourceType: 'image' | 'raw' | 'auto' = 'auto', filename?: string): Promise<string> => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const apiKey = import.meta.env.VITE_CLOUDINARY_API_KEY;
    const apiSecret = import.meta.env.VITE_CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error('Cloudinary credentials missing in .env');
    }

    const timestamp = Math.round(new Date().getTime() / 1000);

    // For raw files (like PDF), having the extension in public_id ensures a clean URL.
    // However, for 'image' type, Cloudinary handles formatting via the URL extension.
    let publicId = filename ? filename.replace(/[^a-zA-Z0-9]/g, '_') : undefined;
    if (publicId && resourceType === 'raw' && !publicId.toLowerCase().endsWith('.pdf')) {
        publicId += '.pdf';
    }

    // Parameters to sign
    // IMPORTANT: Only include parameters that Cloudinary expects in the signature.
    // content_disposition is often not accepted in the signature for raw uploads in some configurations.
    const params: Record<string, any> = {
        public_id: publicId,
        timestamp: timestamp
    };

    const signature = await generateSignature(params, apiSecret);

    const formData = new FormData();
    // Providing a filename in the 3rd argument of append ensures correct mime-type detection for Blobs
    formData.append('file', file, filename ? `${filename}.pdf` : 'document.pdf');
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    if (publicId) {
        formData.append('public_id', publicId);
    }

    // Resource type in URL: image, raw, video, or auto
    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
        {
            method: 'POST',
            body: formData,
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Cloudinary upload failed');
    }

    const data = await response.json();
    return data.secure_url;
};

/**
 * Extracts public_id from a Cloudinary URL
 * @param url The secure_url from Cloudinary
 */
function getPublicIdFromUrl(url: string): string | null {
    try {
        // format: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{public_id}.{extension}
        const parts = url.split('/');
        const uploadIndex = parts.indexOf('upload');
        if (uploadIndex === -1) return null;

        // Skip upload and version part (if version exists it starts with 'v' followed by digits)
        let startIndex = uploadIndex + 1;
        if (parts[startIndex].startsWith('v') && /^\d+$/.test(parts[startIndex].substring(1))) {
            startIndex++;
        }

        // Join the rest and remove extension
        const remaining = parts.slice(startIndex).join('/');
        const lastDotIndex = remaining.lastIndexOf('.');
        if (lastDotIndex === -1) return remaining;

        return remaining.substring(0, lastDotIndex);
    } catch (e) {
        console.error('Error parsing Cloudinary URL:', e);
        return null;
    }
}

/**
 * Deletes an image from Cloudinary
 * @param url The secure_url of the image to delete
 */
export const deleteFromCloudinary = async (url: string): Promise<void> => {
    if (!url) return;

    const publicId = getPublicIdFromUrl(url);
    if (!publicId) {
        console.warn('Could not extract public_id from URL:', url);
        return;
    }

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const apiKey = import.meta.env.VITE_CLOUDINARY_API_KEY;
    const apiSecret = import.meta.env.VITE_CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error('Cloudinary credentials missing in .env');
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const params = {
        public_id: publicId,
        timestamp: timestamp
    };

    const signature = await generateSignature(params, apiSecret);

    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
        {
            method: 'POST',
            body: formData,
        }
    );

    if (!response.ok) {
        const error = await response.json();
        console.error('Cloudinary delete failed:', error);
        throw new Error(error.error?.message || 'Cloudinary deletion failed');
    }
};
