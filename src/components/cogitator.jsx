import React from 'react';
import { onAuthStateChanged } from 'firebase/auth';

import DebouncedSearchBox from './debouncedSearch.jsx';
import DebouncedRefinementList from './debouncedRefListSearch.jsx';
import { FirebaseContext } from './firebase';

import './cogitator.css';
import QuotationEditForm from './quotationEditForm.jsx';


class CogitatorComponent extends React.Component {
  static contextType = FirebaseContext;
  constructor(props) {
    super(props);
    this.state = {
      showSubmitForm: false,
      isLoggedIn: false,
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
    this.unsubAuth = onAuthStateChanged(this.context.auth, (user) => {
      this.setState({ isLoggedIn: !!user });
    });
  }

  componentWillUnmount() {
    if (this.unsubAuth) this.unsubAuth();
  }

  render() {
    return (
      <div className="cogitator">
        <div className="cogitator-top-row">
          <DebouncedSearchBox />
          {this.state.isLoggedIn && (
            <input className="button-add-new" type="button" value="new..." onClick={this.onClick} />
          )}
        </div>

        <div className="submit-form-wrapper" ref={this.wrapperRef}>
          <section ref={this.sectionRef}>
            {this.state.showSubmitForm ? <QuotationEditForm doneCallback={this.formDoneCallback} /> : ''}
          </section>
        </div>

        <DebouncedRefinementList attribute="tags" />
      </div>
    );
  }
}

export default CogitatorComponent;
