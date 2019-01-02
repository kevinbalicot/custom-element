const assert = require('assert');
const { JSDOM } = require('jsdom-wc');

const dom = new JSDOM(``, { runScripts: 'dangerously' });
const window = dom.window;

Object.assign(global, {
  document: window.document,
  HTMLElement: window.HTMLElement,
  customElements: window.customElements,
  CustomEvent: window.CustomEvent,
  window,
});

const { CustomElement } = require('./../src/custom-element');

class MyComponent extends CustomElement {
    static get template() {
        return '<h1>Hello world</h1>';
    }
}

describe('Custom Element', () => {
    before(() => {
        window.customElements.define('my-component', MyComponent);
    });

    it('should be initialize with contentxD', () => {
        window.document.body.innerHTML = '<my-component></my-component>';

        assert.equal(window.document.querySelector('my-component') instanceof CustomElement, true);
        assert.equal(window.document.querySelector('my-component').element('h1').innerHTML, 'Hello world');
    });
});
