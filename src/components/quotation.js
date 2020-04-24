import React from 'react';
import './quotation.css';


class QuotationComponent extends React.Component {
  constructor(props) {
    super(props);

    const fullText = props.hit.text;

    var charIdx = fullText.length;
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
    this.defaultTextToShow = this.defaultTextToShow.bind(this);
    this.expandedTextToShow = this.expandedTextToShow.bind(this);

    this.wrapperRef = React.createRef();
    this.sectionRef = React.createRef();


    this.state = {
      quotation: props.hit,
      alwaysShowText,
      expandShowText,
      detailsSection: '',
    };

    this.state.actualText = this.defaultTextToShow();
  }

  componentDidUpdate() {
    this.wrapperRef.current.style.height = `${this.sectionRef.current.clientHeight}px`;
  }

  onMouseEnter(event) {
    const tags = this.state.quotation.tags.map((x) => <li className="tag">{x}</li>);

    const detailsSection = (
      <div className="quote-details">
        <cite>
          <span dangerouslySetInnerHTML={{ __html: this.state.quotation.real_source }} />
        </cite>
        <cite>
          Found on: <span dangerouslySetInnerHTML={{ __html: this.state.quotation.found_on }} />
        </cite>
        <ul>
          Tags: {tags}
        </ul>
      </div>
    );
    this.setState({
      actualText: this.expandedTextToShow(),
      detailsSection,
    });
  }

  onMouseLeave(event) {
    this.setState({
      actualText: this.defaultTextToShow(),
      detailsSection: '',
    });
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
    return (
      <div className="quotation-wrapper" onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave} ref={this.wrapperRef}>
        <section ref={this.sectionRef} className="quotation">
          <q>
            {this.state.actualText}
          </q>
          <cite><div dangerouslySetInnerHTML={{ __html: this.state.quotation.lore_source }} /></cite>
          {this.state.detailsSection}
        </section>
      </div>
    );
  }
}

export default QuotationComponent;
