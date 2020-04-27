import React from 'react';

import { RefinementList } from 'react-instantsearch-dom';

import DebouncedSearchBox from './debouncedSearch';
import DebouncedRefinementList from './debouncedRefListSearch';

import './cogitator.css';
import QuotationEditForm from './quotationEditForm.js';


class CogitatorComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showSubmitForm: false,
    };

    this.onClick = this.onClick.bind(this);
    this.formDoneCallback = this.formDoneCallback.bind(this);

    this.wrapperRef = React.createRef();
    this.sectionRef = React.createRef();
  }

  onClick(event) {
    this.setState((prev) => ({ showSubmitForm: !prev.showSubmitForm }));
  }

  formDoneCallback() {
    this.setState((prev) => ({
      showSubmitForm: false,
    }));
  }

  componentDidUpdate() {
    this.wrapperRef.current.style.height = `${this.sectionRef.current.clientHeight}px`;
  }

  componentDidMount() {
    // initially it's undefined so the first transition is broken.. so force set it to 0px.
    this.wrapperRef.current.style.height = '0px';
  }

  render() {
    return (
      <div className="cogitator">
        <div className="cogitator-top-row">
          <DebouncedSearchBox />
          <input className="button-add-new" type="button" value="Submit new" onClick={this.onClick} />
        </div>

        <div className="submit-form-wrapper" ref={this.wrapperRef}>
          <section ref={this.sectionRef}>
            {this.state.showSubmitForm ? <QuotationEditForm doneCallback={this.formDoneCallback} /> : ''}
          </section>
        </div>

        <DebouncedRefinementList attribute="tags" searchable />
      </div>
    );
  }
}

export default CogitatorComponent;
