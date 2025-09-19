export function extractFilenameFromDisposition(disposition) {
    if (!disposition) {
        return null;
    }
    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i;
    const matches = filenameRegex.exec(disposition);
    if (matches && matches[1]) {
        return matches[1].replace(/['"]/g, '').trim();
    }
    return null;
}

export function downloadBlobResponse(response, fallbackFilename) {
    const { data, headers } = response;
    const contentDisposition = headers ? headers['content-disposition'] : null;
    const filename = extractFilenameFromDisposition(contentDisposition) || fallbackFilename;
    const contentType = headers ? headers['content-type'] : 'application/octet-stream';

    const blob = new Blob([data], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

