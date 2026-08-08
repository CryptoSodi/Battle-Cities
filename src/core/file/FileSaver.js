"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSaver = void 0;
class FileSaver {
    saveJSON(json, fileName = 'file.json') {
        const jsonEncoded = window.encodeURIComponent(json);
        const dataStr = `data:text/json;charset=utf-8,${jsonEncoded}`;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataStr);
        linkElement.setAttribute('download', fileName);
        linkElement.click();
    }
}
exports.FileSaver = FileSaver;
