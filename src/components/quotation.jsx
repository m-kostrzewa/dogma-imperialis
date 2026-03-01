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
    this.onMouseEnter = this.onMouseEnter.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);

    this.clippedRef = React.createRef();
    this.detailsRef = React.createRef();

    this.state = {
      quotation: props.hit,
      showEditForm: false,
    };
  }

  onMouseEnter() {
    if (this.clippedRef.current) {
      this.clippedRef.current.style.maxHeight = this.clippedRef.current.scrollHeight + 'px';
    }
    if (this.detailsRef.current) {
      this.detailsRef.current.style.maxHeight = this.detailsRef.current.scrollHeight + 'px';
    }
  }

  onMouseLeave() {
    if (this.clippedRef.current) {
      this.clippedRef.current.style.maxHeight = '';
    }
    if (this.detailsRef.current) {
      this.detailsRef.current.style.maxHeight = '';
    }
  }

  onFormClick(event) {
    event.stopPropagation();
    this.setState((prev) => ({ showEditForm: !prev.showEditForm }));
  }

  formDoneCallback() {
    this.setState({ showEditForm: false });
  }

  componentDidMount() {
    // If the content fits within max-height, hide the fade overlay
    const el = this.clippedRef.current;
    if (el && el.scrollHeight <= el.clientHeight) {
      el.classList.add('no-clip');
    }
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
      <div className="quote-details" ref={this.detailsRef}>
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
      <div className="quotation-wrapper" onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
        <section className="quotation">
          <div className="quotation-clipped" ref={this.clippedRef}>
            <q>{text}</q>
          </div>
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
