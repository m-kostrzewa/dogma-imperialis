import React from 'react';
import './quotation.css';

import QuotationEditForm from './quotationEditForm.js';


class QuotationComponent extends React.Component {
  constructor(props) {
    super(props);

    const fullText = props.hit.text;

    let charIdx = fullText.length;
    if (fullText.length > 200) {
      charIdx = 200;
      while (fullText[charIdx] !== ' ' && charIdx <= fullText.length) {
        charIdx += 1;
      }
    }
    const alwaysShowText = fullText.slice(0, charIdx);
    const expandShowText = fullText.slice(charIdx);

    this.onMouseEnter = this.onMouseEnter.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onFormClick = this.onFormClick.bind(this);
    this.defaultTextToShow = this.defaultTextToShow.bind(this);
    this.expandedTextToShow = this.expandedTextToShow.bind(this);
    this.formDoneCallback = this.formDoneCallback.bind(this);

    this.wrapperRef = React.createRef();
    this.sectionRef = React.createRef();


    this.state = {
      quotation: props.hit,
      alwaysShowText,
      expandShowText,
      detailsSection: '',
      displayEverything: false,
      showEditForm: false,
      forceUpdate: false,
    };

    this.state.actualText = this.defaultTextToShow();
  }

    componentDidMount() {
      // initially it's undefined so the first transition is broken.. so force set it to 0px.
      // ugly hack with on mouse enter but we must see initial text for this to work...
      this.onMouseEnter();
      this.wrapperRef.current.style.height = '0px';
      this.onMouseLeave();
  }

  componentDidUpdate() {
    this.wrapperRef.current.style.height = `${this.sectionRef.current.clientHeight}px`;
  }

  onMouseEnter(event) {
    if (this.state.showEditForm) {
      return;
    }
    this.setState({
      displayEverything: true,
    });
  }

  onClick(event) {
    if (this.state.showEditForm) {
      return;
    }

    this.setState((prev) => ({
      forceDetailsOn: !prev.forceDetailsOn,
    }));
  }

  onMouseLeave(event) {
    if (this.state.showEditForm) {
      return;
    }

    if (!this.state.forceDetailsOn) {
      this.setState({
        displayEverything: false,
      });
    } else {
      this.setState({
        displayEverything: true,
      });
    }
  }


  generateDetailsSection() {
    const tags = this.state.quotation.tags.map((x) => <li className="tag">{x}</li>);

    const detailsSection = (
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
          <ul>
            {tags}
          </ul>
        </span>
      </div>
    );
    return detailsSection;
  }

  defaultTextToShow() {
    let textToShow = this.state.alwaysShowText;
    if (this.state.expandShowText.length !== 0) {
      textToShow += ' (...)';
    }
    return textToShow;
  }

  expandedTextToShow() {
    return this.state.alwaysShowText + this.state.expandShowText;
  }

  onFormClick(event) {
    this.setState((prev) => ({
      showEditForm: !prev.showEditForm,
    }));
  }

  formDoneCallback() {
    this.setState((prev) => ({
      showEditForm: false,
    }));
  }

  render() {
    let text;
    let details;
    if (this.state.displayEverything) {
      text = this.expandedTextToShow();
      details = this.generateDetailsSection();
    } else {
      text = this.defaultTextToShow();
      details = '';
    }

    return (
      <div className="quotation-wrapper" onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave} onClick={this.onClick} ref={this.wrapperRef}>
        <section ref={this.sectionRef} className="quotation">
          <q>
            {text}
          </q>
          <cite><div dangerouslySetInnerHTML={{ __html: this.state.quotation.lore_source }} /></cite>
          {details}

          {this.state.displayEverything ? <input type="button" className="button-small" onClick={this.onFormClick} value="Correction" /> : '' }

          {this.state.showEditForm ? <QuotationEditForm quotation={this.state.quotation} doneCallback={this.formDoneCallback} /> : ''}
        </section>
      </div>
    );
  }
}

export default QuotationComponent;
