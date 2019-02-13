const assert = require('assert');
const { JSDOM } = require('jsdom-wc');

const callers = {
    onConnected: 0,
    onChanges: 0,
    onDisconnected: 0
};
const dom = new JSDOM('', { runScripts: 'dangerously' });
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
    constructor() {
        super();

        this.text = 'My webpage';
        this.info = false;
        this.items = [];
        this.clicks = 0;
    }

    onConnected() {
        callers.onConnected++;
    }

    onChanges() {
        callers.onChanges++;
    }

    onDisconnected() {
        callers.onDisconnected++;
    }

    static get template() {
        return `
            <h1>Hello world</h1>
            <div [innerHTML]="this.text"></div>
            <p #if="this.info">My information banner</p>
            <ul><li #for="let i of this.items" [innerHTML]="i"></li></ul>
            <button (click)="this.clicks++">Click here</button>
            <a href="">Click on my link</a>
        `;
    }

    static get styles() {
        return ['h1 { color: red; }'];
    }

    static get observedAttributes() {
        return ['foo'];
    }
}

describe('Custom Element', () => {
    before(() => {
        window.customElements.define('my-component', MyComponent);
        window.document.body.innerHTML = '<my-component></my-component>';
    });

    it('should be initialize with content', () => {
        const element = window.document.querySelector('my-component');

        assert.equal(element instanceof CustomElement, true);

        assert.equal(callers.onConnected, 1);
        assert.equal(callers.onChanges, 0);
        assert.equal(callers.onDisconnected, 0);

        assert.equal(element.element('h1').innerHTML, 'Hello world');
        assert.equal(element.element('div').innerHTML, element.text);
    });

    it('should be initialize with styles', () => {
        const element = window.document.querySelector('my-component');

        assert(element.element('style'));
        assert(element.element('style').textContent);
    });

    it('should be able to update content', () => {
        const element = window.document.querySelector('my-component');
        const expected = 'I changed my webpage.';

        assert.equal(element.element('div').innerHTML, element.text);

        element.text = expected;
        element.update('div');

        assert.equal(element.element('div').innerHTML, expected);
    });

    it('should be able to change observed attributes', () => {
        const element = window.document.querySelector('my-component');
        const expected = 'bar';
        const expected2 = '{ "foo": "bar" }';

        assert.strictEqual(element.getAttribute('foo'), null);

        element.setAttribute('foo', expected);

        assert.equal(callers.onChanges, 1);
        assert.strictEqual(element.getAttribute('foo'), expected);
        assert.strictEqual(element.foo, expected);

        element.setAttribute('foo', expected2);

        assert.equal(callers.onChanges, 2);
        assert.strictEqual(element.getAttribute('foo'), expected2);
        assert.equal(typeof element.foo === 'object', true);
        assert.strictEqual(element.foo.foo, JSON.parse(expected2).foo);
    });

    it('should be able to display or remove HTML element with #if', () => {
        const element = window.document.querySelector('my-component');

        assert(!element.element('p'));

        element.info = true;
        element.update('p');

        assert(element.element('p'));
    });

    it('should be able to add or remove HTML elements with #for', () => {
        const element = window.document.querySelector('my-component');
        const expected = 1;

        assert.equal(element.element('ul').children.length, 0);

        element.items.push(expected);
        element.update('ul');

        assert.equal(element.element('ul').children.length, 1);
        assert.strictEqual(element.element('ul').children[0].innerHTML, String(expected));

        [1,2,3,4,5].forEach(i => {
            element.items.push(i);
            assert.equal(element.element('ul').children.length, element.items.length - 1);
            element.update('ul');
            assert.equal(element.element('ul').children.length, element.items.length);
        });

        element.items.splice(0, 1);
        assert.equal(element.element('ul').children.length, element.items.length + 1);
        element.update('ul');
        assert.equal(element.element('ul').children.length, element.items.length);
    });

    it('should be able to add events listeners with method and into template', done => {
        const element = window.document.querySelector('my-component');

        assert.equal(element.clicks, 0);

        element.element('a').on('click', event => {
            assert.deepEqual(element.element('a'), event.target);
            done();
        });

        element.element('button').click();
        assert.equal(element.clicks, 1);
        element.element('a').click();
    });
});
