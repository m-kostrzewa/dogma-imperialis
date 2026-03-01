import React from 'react';
import './quotation.css';

import {FirebaseContext} from './firebase';
import QuotationEditForm from './quotationEditForm.jsx';


class QuotationComponent extends React.Component {
  static contextType = FirebaseContext;

  constructor(props) {
    super(props);

    this.onFormClick = this.onFormClick.bind(this);
    this.formDoneCallback = this.formDoneCallback.bind(this);

    this.state = {
      quotation: props.hit,
      showEditForm: false,
    };
  }

  onFormClick(event) {
    event.stopPropagation();
    this.setState((prev) => ({ showEditForm: !prev.showEditForm }));
  }

  formDoneCallback() {
    this.setState({ showEditForm: false });
  }

  formatNewlines(text) {
    const parts = text.split('\n');
    return parts.map((item, i) =>
      i < parts.length - 1
        ? <span key={i}>{item}<br/></span>
        : <span key={i}>{item}</span>
    );
  }

  generateDetailsSection() {
    const tags = this.state.quotation.tags.map((x, i) => <li key={i} className="tag">{x}</li>);
    return (
      <div className="quote-details">
        <span>Realspace source:</span>
        <cite>
          <span dangerouslySetInnerHTML={{ __html: this.state.quotation.real_source }} />
        </cite>
        <span>Credit:</span>
        <cite>
          <span dangerouslySetInnerHTML={{ __html: this.state.quotation.found_on }} />
        </cite>
        <span>Tags:</span>
        <span>
          <ul>{tags}</ul>
        </span>
      </div>
    );
  }

  render() {
    const { quotation, showEditForm } = this.state;
    const text = this.formatNewlines(quotation.text);

    return (
      <div className="quotation-wrapper">
        <section className="quotation">
          <q>{text}</q>
          <cite><div dangerouslySetInnerHTML={{ __html: quotation.lore_source }} /></cite>
          {this.generateDetailsSection()}

          {this.context.currentUser
            ? <input type="button" className="button-small" onClick={this.onFormClick} value="Correction" />
            : ''}

          {showEditForm
            ? <QuotationEditForm quotation={quotation} doneCallback={this.formDoneCallback} />
            : ''}
        </section>
      </div>
    );
  }
}

export default QuotationComponent;
