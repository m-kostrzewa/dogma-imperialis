import React from 'react';
import ReactDOM from 'react-dom';
import './quotation.css';
import { Hits } from 'react-instantsearch-dom';


class QuotationComponent extends React.Component {
  constructor(props) {
    super(props);

    let fullText = props.hit.text;

    charIdx = fullText.length;
    if (charIdx > 200) {
      var charIdx = 200;
      while (fullText[charIdx] != ' ') {
        charIdx += 1;
      }
    }
    const alwaysShowText = fullText.slice(0, charIdx);
    const detailShowText = fullText.slice(charIdx);

    var threeDots = " (...) ";
    if(detailShowText.length === 0) {
        threeDots = "";
    }

    console.log(fullText);
    console.log(alwaysShowText);
    console.log("detail", detailShowText);

    this.state = {
      quotation: props.hit,
      showDetails: false,
      alwaysShowText,
      detailShowText,
      threeDots,
    };

    // this.props.firebase.db.collection('quotes').orderBy('text').limit(10).get()
    //   .then((querySnapshot) => {
    //     querySnapshot.forEach((doc) => {
    //       this.setState((prevState) => ({
    //         quotations: [...prevState.quotations, doc.data()],
    //       }));
    //     });
    //   })
    //   .catch((error) => {
    //     console.log('Error getting documents: ', error);
    //   });
    // this.state = {
    //   quotations: [
    //     {
    //       text: 'The weak in mind will seek to understand the xenos. The strong in mind will destroy them, and bless their ignorance',
    //       lore_source: 'Binary Hierarch Gethsemorr',
    //       real_source: 'Warhammer 40,000: Mechanicus',
    //       tags: ['weak', 'xenos', 'ignorance', 'mind', 'understanding', 'strong'],
    //     },
    //     {
    //       text: 'Be thou wary of the works of the alien, for their presence is poison and their every word deceit.',
    //       lore_source: 'Gathalamoreans, 94.3',
    //       real_source: 'Warhammer 40,000: Mechanicus',
    //     },
    //     {
    //       text: 'We are derelict in our duty whenever we allow corruption to plague the minds of good men.',
    //       lore_source: 'Tech-Cosmos Verse 68',
    //       real_source: 'Warhammer 40,000: Mechanicus',
    //     },
    //     {
    //       text: 'From such small heresies are great apostasies made.',
    //       lore_source: 'Maxims Metalica, 76.12',
    //       real_source: 'Tech-Cosmos Verse 68',
    //     },
    //     {
    //       text: 'From the mouths of heretics emit naught but foul vapours. Cut out the tongue and be clean.',
    //       lore_source: 'Quaestos Mechanicor 5.21',
    //       real_source: 'Warhammer 40,000: Mechanicus',
    //     },
    //     {
    //       text: 'Better safe and ignorant, than rueing the means of our downfall.',
    //       lore_source: 'Macharian Notions, Chapter 4113',
    //       real_source: 'Warhammer 40,000: Mechanicus',
    //     },
    //     {
    //       text: 'Sometimes the weak limb must be amputated before the whole body withers.',
    //       lore_source: 'Selucian Aphorisms, Verse 539',
    //       real_source: 'Warhammer 40,000: Mechanicus',
    //     },
    //     {
    //       text: 'In each society there is a classification that is mirrored in another society.',
    //       lore_source: 'Scripture-Brother Magos Tech-Auxilium Prime, Know Thy Enemy, to Know Thyself',
    //       real_source: 'Warhammer 40,000: Mechanicus',
    //     },
    //     {
    //       text: 'When the heretic is silenced, it is as if his weapons and tools are stripped of him, he is left impotent and weak.',
    //       lore_source: 'Jovian Ministrations 61.90',
    //       real_source: 'Warhammer 40,000: Mechanicus',
    //     },
    //   ],
    // };

    this.onMouseEnter = this.onMouseEnter.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
  }

  onMouseEnter(event) {
    this.setState({
      showDetails: true,
    });
  }

  onMouseLeave(event) {
    this.setState({
      showDetails: false,
    });
  }


  render() {
    // const quotationsList = this.state.quotations.map((q, idx) => {
    //   const style = {
    //     animationDelay: `${idx / 10}s`,
    //   };
    // style={style}>
    const q = this.state.quotation;

    return (
      <div className="quotation-wrapper" onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
        <section className="quotation">
          <q>
            <span className="visible-text">{this.state.alwaysShowText}</span>
            <span className="three-dots">{this.state.threeDots}</span>
            <span className="hidden-text">{this.state.detailShowText}</span>
          </q>
          <cite><div dangerouslySetInnerHTML={{ __html: q.lore_source }} /></cite>
          <cite><div dangerouslySetInnerHTML={{ __html: q.real_source }} /></cite>
        </section>
      </div>
    );
  }
  // return quotationsList;
//   }
}

export default QuotationComponent;
