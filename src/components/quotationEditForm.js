import React from 'react';

import axios from 'axios';

import './quotationEditForm.css';


class QuotationComponent extends React.Component {
  constructor(props) {
    super(props);

    const formData = {};
    if (props.quotation) {
      formData.objectID = props.quotation.objectID;
      formData.new_text = props.quotation.text;
      formData.new_lore_source = props.quotation.lore_source;
      formData.new_real_source = props.quotation.real_source;
      formData.new_credit = props.quotation.found_on;
      formData.new_tags_str = props.quotation.tags.join('; ');
      formData.contact_email = '';
      formData.additional_notes = '';
      formData.want_credit_nickname = '';
    }


    this.state = {
      showEditForm: false,
      doneCallback: props.doneCallback,
      formData,
      submitStatusText: '',
    };

    this.onSubmit = this.onSubmit.bind(this);
    this.onChange = this.onChange.bind(this);
  }

  onSubmit(event) {
    event.preventDefault();
    console.log(this.state);

    this.setState({
      submitStatusText: 'Sending, please wait...',
    });

    axios.post('https://us-central1-dogma-imperialis.cloudfunctions.net/contactFormSubmit', this.state.formData).catch((error) => {
      console.log(error);
    }).then((response) => {
      this.setState({
        submitStatusText: 'Form sent, thanks!',
      });
      setTimeout(() => {
        this.state.doneCallback();
        this.setState({
          submitStatusText: '',
        });
      }, 3000);

      console.log(response.status);
      console.log(response.data);
    });
  }

  onChange(event) {
    const { target } = event;
    const { value } = target;
    this.setState((prev) => ({
      formData: {
        ...prev.formData,
        [target.name]: value,
      },
    }));
  }

  render() {
    if (this.state.submitStatusText) {
      return (
        <div className="quotation-edit-form">
          <p className="quotation-edit-form-status-text">{this.state.submitStatusText}</p>
        </div>
      );
    }

    return (
      <div className="quotation-edit-form">
        <form onSubmit={this.onSubmit}>
          <div className="form-row">
            <p className="quotation-edit-from-label">Quotation text:</p>
            <textarea
              required
              className="quotation-edit-form-field"
              name="new_text"
              rows="4"
              value={this.state.formData.new_text}
              onChange={this.onChange}
            />
          </div>

          <div className="form-row">
            <p className="quotation-edit-from-label">Lore source: </p>
            <textarea
              required
              className="quotation-edit-form-field"
              name="new_lore_source"
              rows="2"
              placeholder="In-fiction source of quoation"
              value={this.state.formData.new_lore_source}
              onChange={this.onChange}
            />
          </div>

          <div className="form-row">
            <p className="quotation-edit-from-label">Realspace source: </p>
            <textarea
              required
              className="quotation-edit-form-field"
              name="new_real_source"
              rows="2"
              placeholder="Official Warhammer 40k source of quotation"
              value={this.state.formData.new_real_source}
              onChange={this.onChange}
            />
          </div>

          <div className="form-row">
            <p className="quotation-edit-from-label">Credit: </p>
            <textarea
              required
              className="quotation-edit-form-field"
              name="new_credit"
              rows="2"
              placeholder="If you found the quotation on some fan creation, please credit it here"
              value={this.state.formData.new_credit}
              onChange={this.onChange}
            />
          </div>

          <div className="form-row">
            <p className="quotation-edit-from-label">Tags: </p>
            <textarea
              required
              className="quotation-edit-form-field"
              name="new_tags_str"
              rows="1"
              placeholder="Comma-separated list of tags to apply"
              value={this.state.formData.new_tags_str}
              onChange={this.onChange}
            />
          </div>

          <div className="form-row">
            <p className="quotation-edit-from-label">Contact email: </p>
            <input
              required
              className="quotation-edit-form-field"
              name="contact_email"
              type="email"
              placeholder="This email will be used in case moderator has any questions"
              value={this.state.formData.contact_email}
              onChange={this.onChange}
            />
          </div>

          <div className="form-row">
            <p className="quotation-edit-from-label">Notes: </p>
            <textarea
              className="quotation-edit-form-field"
              name="additional_notes"
              rows="2"
              placeholder="(Optional) additional notes for moderator"
              value={this.state.formData.additional_notes}
              onChange={this.onChange}
            />
          </div>

          <div className="form-row">
            <p className="quotation-edit-from-label">Nickname: </p>
            <textarea
              className="quotation-edit-form-field"
              name="want_credit_nickname"
              rows="1"
              placeholder="(Optional) your nickname for credit"
              value={this.state.formData.want_credit_nickname}
              onChange={this.onChange}
            />
          </div>

          <div className="quotation-edit-form-lower-div">
            <span>
              A moderator will review and may adjust your submission before adding it to database.
              The process may take a few days. Thank you for your patience and for improving Dogma Imperialis.
            </span>
            <input className="button-small" type="submit" title="Submit" />
          </div>
        </form>
      </div>
    );
  }
}

export default QuotationComponent;
