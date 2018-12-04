import { WebComponent, component } from './src/component';
import { di, service } from './src/container';
import { Document } from './src/dom';

export { WebComponent, Document, component, di, service };

window.WebComponent = WebComponent;
window.Document = Document;
window.di = di;
window.service = service;
window.component = component;
