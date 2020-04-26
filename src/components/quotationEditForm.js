import React from 'react';

import axios from 'axios';

import './quotation-edit-form.css';


class QuotationComponent extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      quotation: props.quotation,
      parentCanHideCallback: props.canHideCallback,
      showEditForm: false,
      formData: {
        objectID: props.quotation.objectID,
        new_text: props.quotation.text,
        new_lore_source: props.quotation.lore_source,
        new_real_source: props.quotation.real_source,
        new_credit: props.quotation.found_on,
        new_tags_str: props.quotation.tags.join(', '),
        contact_email: '',
        additional_notes: '',
        want_credit_nickname: '',
      },
      submitStatusText: '',
    };

    this.onClick = this.onClick.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this.onChange = this.onChange.bind(this);
  }

  onClick(event) {
    this.setState((prev) => ({
      showEditForm: !prev.showEditForm,
    }), () => {
      this.state.parentCanHideCallback(!this.state.showEditForm);
    });
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
      this.state.parentCanHideCallback(true);

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
    if (this.state.submitStatusText !== '') {
      return (
        <div className="quotation-edit-form">
          <input type="button" className="button-small" onClick={this.onClick} value="Suggest correction"/>
          {this.state.submitStatusText}
        </div>
      );
    } if (this.state.showEditForm) {
      return (
        <div className="quotation-edit-form">
          <input type="button" className="button-small" onClick={this.onClick} value="Close correction form"/>
          <form onSubmit={this.onSubmit}>
            <p>Quotation text:</p>
            <textarea required class="quotation-edit-form-field" name="new_text" rows="4"
                value={this.state.formData.new_text} onChange={this.onChange} />

            <p>Lore source: </p>
            <textarea required class="quotation-edit-form-field" name="new_lore_source" rows="2"
                value={this.state.formData.new_lore_source} onChange={this.onChange} />

            <p>Realspace source: </p>
            <textarea required class="quotation-edit-form-field" name="new_real_source" rows="2"
                value={this.state.formData.new_real_source} onChange={this.onChange} />

            <p>Credit: </p>
            <textarea required class="quotation-edit-form-field" name="new_credit" rows="2"
                value={this.state.formData.new_credit} onChange={this.onChange} />

            <p>Tags: </p>
            <textarea required class="quotation-edit-form-field" name="new_tags_str" rows="1"
                value={this.state.formData.new_tags_str} onChange={this.onChange} />

            <p>Contact email: </p>
            <input required class="quotation-edit-form-field" name="contact_email" type="email"
                placeholder="This email will be used in case moderator has any questions"
                value={this.state.formData.contact_email} onChange={this.onChange} />

            <p>Notes: </p>
            <textarea class="quotation-edit-form-field" name="additional_notes" rows="2"
                placeholder="(Optional) additional notes for moderator"
                value={this.state.formData.additional_notes} onChange={this.onChange} />

            <p>Nickname: </p>
            <textarea class="quotation-edit-form-field" name="want_credit_nickname" rows="1"
                placeholder="(Optional) your nickname for credit"
                value={this.state.formData.want_credit_nickname} onChange={this.onChange} />

            <div class="quotation-edit-form-lower-div">
                <span>A moderator will review and may adjust your submission before adding it to database.
                    The process may take a few days. Thank you for your patience and for improving Dogma Imperialis.</span>
                <input className="button-small" type="submit" title="Submit" />
            </div>
          </form>
        </div>
      );
    }
    return (
      <div className="quotation-edit-form">
          <input type="button" className="button-small" onClick={this.onClick} value="Suggest correction"/>
      </div>
    );
  }
}

export default QuotationComponent;
