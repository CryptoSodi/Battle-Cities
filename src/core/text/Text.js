"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Text = exports.TextAlignment = void 0;
const Size_1 = require("../Size");
const Vector_1 = require("../Vector");
const fonts_1 = require("./fonts");
var TextAlignment;
(function (TextAlignment) {
    TextAlignment[TextAlignment["Left"] = 0] = "Left";
    TextAlignment[TextAlignment["Center"] = 1] = "Center";
    TextAlignment[TextAlignment["Right"] = 2] = "Right";
})(TextAlignment = exports.TextAlignment || (exports.TextAlignment = {}));
const DEFAULT_OPTIONS = {
    alignment: TextAlignment.Left,
    letterSpacing: 1,
    lineSpacing: 1,
};
const TEXT_LINE_SEPARATOR = '\n';
const TEXT_WORD_SEPARATOR = ' ';
class Text {
    constructor(text = '', options = {}) {
        this.text = '';
        this.font = new fonts_1.NullFont();
        this.text = text;
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    }
    setText(text) {
        this.text = text;
        return this;
    }
    setFont(font) {
        this.font = font;
        return this;
    }
    setOptions(options = {}) {
        this.options = Object.assign({}, this.options, options);
        return this;
    }
    getFont() {
        return this.font;
    }
    build() {
        // TODO: text offset can be passed from outside, but it won't work now
        // because external offset is scaled, but internal calculated offset is not
        const textOffset = new Vector_1.Vector(0, 0);
        const items = this.buildLinesFromText(this.text, textOffset);
        return items;
    }
    getWidth() {
        const unscaledWidth = this.getUnscaledTextWidth(this.text);
        const scale = this.font.getScale();
        const width = unscaledWidth * scale.x;
        return width;
    }
    getHeight() {
        const { lineSpacing } = this.options;
        const lines = this.splitTextToLines(this.text);
        const characterHeight = this.font.getCharacterHeight();
        const scale = this.font.getScale();
        const charactersHeight = lines.length * characterHeight * scale.y;
        const spacingHeight = (lines.length - 1) * lineSpacing * scale.y;
        const linesHeight = charactersHeight + spacingHeight;
        return linesHeight;
    }
    getSize() {
        const size = new Size_1.Size(this.getWidth(), this.getHeight());
        return size;
    }
    buildLinesFromText(text, textOffset = new Vector_1.Vector(0, 0)) {
        const textItems = [];
        const characterHeight = this.font.getCharacterHeight();
        const textWidth = this.getUnscaledTextWidth(this.text);
        const lines = this.splitTextToLines(text);
        lines.forEach((line, index) => {
            const lineSpacing = index > 0 ? this.options.lineSpacing : 0;
            const lineOffsetY = index * (characterHeight + lineSpacing);
            let lineOffsetX = 0;
            if (this.options.alignment === TextAlignment.Center) {
                const lineWidth = this.getUnscaledLineWidth(line);
                lineOffsetX = (textWidth - lineWidth) / 2;
            }
            else if (this.options.alignment === TextAlignment.Right) {
                const lineWidth = this.getUnscaledLineWidth(line);
                lineOffsetX = textWidth - lineWidth;
            }
            const lineOffset = textOffset
                .clone()
                .addX(lineOffsetX)
                .addY(lineOffsetY);
            const lineItems = this.buildWordsFromLine(line, lineOffset);
            textItems.push(...lineItems);
        });
        return textItems;
    }
    buildWordsFromLine(line, lineOffset = new Vector_1.Vector(0, 0)) {
        const lineItems = [];
        let wordOffsetX = 0;
        const words = this.splitLineToWords(line);
        words.forEach((word, index) => {
            const wordOffset = lineOffset.clone().addX(wordOffsetX);
            const wordWidth = this.getUnscaledWordWidth(word);
            const wordItems = this.buildCharactersFromWord(word, wordOffset);
            lineItems.push(...wordItems);
            const wordSpacing = index < words.length - 1 ? this.getWordSeparatorWidth() : 0;
            wordOffsetX += wordWidth + wordSpacing;
        });
        return lineItems;
    }
    buildCharactersFromWord(word, wordOffset = new Vector_1.Vector(0, 0)) {
        const wordItems = [];
        const scale = this.font.getScale();
        const characters = this.splitWordToCharacters(word);
        characters.forEach((character, index) => {
            const letterSpacing = index > 0 ? this.options.letterSpacing : 0;
            const characterOffset = wordOffset
                .clone()
                .addX(index * (this.font.getCharacterWidth() + letterSpacing));
            const characterItem = this.font.buildCharacter(character, scale, characterOffset);
            wordItems.push(characterItem);
        });
        return wordItems;
    }
    getUnscaledTextWidth(text) {
        const lines = this.splitTextToLines(text);
        const lineWidths = lines.map((line) => {
            return this.getUnscaledLineWidth(line);
        });
        const maxLineWidth = Math.max(...lineWidths);
        return maxLineWidth;
    }
    getUnscaledLineWidth(line) {
        let lineWidth = 0;
        const words = this.splitLineToWords(line);
        words.forEach((word, index) => {
            const wordWidth = this.getUnscaledWordWidth(word);
            const wordSpacing = index > 0 ? this.getWordSeparatorWidth() : 0;
            const wordTotalWidth = wordWidth + wordSpacing;
            lineWidth += wordTotalWidth;
        });
        return lineWidth;
    }
    getUnscaledWordWidth(word) {
        const characterWidth = this.font.getCharacterWidth();
        const { letterSpacing } = this.options;
        const charactersWidth = word.length * characterWidth;
        const spacingWidth = (word.length - 1) * letterSpacing;
        const wordWidth = charactersWidth + spacingWidth;
        return wordWidth;
    }
    getWordSeparatorWidth() {
        const { letterSpacing } = this.options;
        const characterWidth = this.font.getCharacterWidth();
        const separatorWidth = characterWidth + letterSpacing * 2;
        return separatorWidth;
    }
    splitTextToLines(text) {
        const lines = text.split(TEXT_LINE_SEPARATOR);
        return lines;
    }
    splitLineToWords(line) {
        const words = line.split(TEXT_WORD_SEPARATOR);
        return words;
    }
    splitWordToCharacters(word) {
        const characters = Array.from(word);
        return characters;
    }
}
exports.Text = Text;
Text.LINE_SEPARATOR = TEXT_LINE_SEPARATOR;
Text.WORD_SEPARATOR = TEXT_WORD_SEPARATOR;
