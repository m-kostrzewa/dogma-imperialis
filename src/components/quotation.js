import React from 'react';
import './quotation.css';


class QuotationComponent extends React.Component {
  constructor(props) {
    super(props);

    const fullText = props.hit.text;

    let charIdx = fullText.length;
    if (fullText.length > 200) {
      charIdx = 200;
      while (fullText[charIdx] != ' ' && charIdx <= fullText.length) {
        charIdx += 1;
      }
    }
    const alwaysShowText = fullText.slice(0, charIdx);
    const expandShowText = fullText.slice(charIdx);

    this.onMouseEnter = this.onMouseEnter.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onClick = this.onClick.bind(this);
    this.defaultTextToShow = this.defaultTextToShow.bind(this);
    this.expandedTextToShow = this.expandedTextToShow.bind(this);

    this.wrapperRef = React.createRef();
    this.sectionRef = React.createRef();


    this.state = {
      quotation: props.hit,
      alwaysShowText,
      expandShowText,
      detailsSection: '',
      displayEverything: false,
    };

    this.state.actualText = this.defaultTextToShow();
  }

  componentDidUpdate() {
    this.wrapperRef.current.style.height = `${this.sectionRef.current.clientHeight}px`;
  }

  onMouseEnter(event) {
    this.setState({
      displayEverything: true,
    });
  }

  onClick(event) {
    this.setState((prev) => ({
        forceDetailsOn: !prev.forceDetailsOn,
    }));
  }

  onMouseLeave(event) {
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
        <span>Found on:</span>
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
        </section>
      </div>
    );
  }
}

export default QuotationComponent;
