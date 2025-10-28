// frontend/src/utils/pdf.js

/**
 * Extract a filename from a Content-Disposition header value.
 * Falls back to ``null`` when no filename can be parsed.
 *
 * @param {string | undefined} disposition
 * @returns {string | null}
 */
export const extractFilenameFromDisposition = (disposition) => {
    if (!disposition) {
        return null;
    }

    const filenameMatch = /filename="?([^";]+)"?/i.exec(disposition);
    return filenameMatch ? decodeURIComponent(filenameMatch[1]) : null;
};

/**
 * Open a PDF blob in a new tab when possible, otherwise trigger a download.
 *
 * @param {Blob} blob
 * @param {string} filename
 */
export const openPdfBlobInNewTab = (blob, filename) => {
    const blobUrl = window.URL.createObjectURL(blob);

    const pdfWindow = window.open('', '_blank');
    if (pdfWindow && !pdfWindow.closed) {
        pdfWindow.document.title = filename;
        pdfWindow.document.write(`
            <html>
                <head><title>${filename}</title></head>
                <body style="margin:0">
                    <embed src="${blobUrl}" type="application/pdf" width="100%" height="100%" />
                </body>
            </html>
        `);
        pdfWindow.document.close();
    } else {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60 * 1000);
};

