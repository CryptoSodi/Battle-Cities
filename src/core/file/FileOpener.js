"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileOpener = void 0;
const Subject_1 = require("../Subject");
const DEFAULT_OPTIONS = {
    multiple: false,
};
class FileOpener {
    constructor(options = {}) {
        this.opened = new Subject_1.Subject();
        this.handleFileChange = () => {
            const { files } = this.fileElement;
            if (files.length === 0) {
                return;
            }
            this.opened.notify(files);
        };
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
        this.fileElement = document.createElement('input');
        this.fileElement.addEventListener('change', this.handleFileChange);
        this.fileElement.setAttribute('type', 'file');
        this.fileElement.setAttribute('multiple', this.options.multiple.toString());
    }
    openDialog() {
        this.fileElement.click();
    }
}
exports.FileOpener = FileOpener;
