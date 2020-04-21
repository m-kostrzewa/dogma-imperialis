import React from 'react';
import ReactDOM from 'react-dom';
import './quotations.css';


class QuotationsComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      quotations: [
        {
          text: 'The weak in mind will seek to understand the xenos. The strong in mind will destroy them, and bless their ignorance',
          lore_source: 'Binary Hierarch Gethsemorr',
          realspace_source: 'Warhammer 40,000: Mechanicus',
          tags: ['weak', 'xenos', 'ignorance', 'mind', 'understanding', 'strong'],
        },
        {
          text: 'Be thou wary of the works of the alien, for their presence is poison and their every word deceit.',
          lore_source: 'Gathalamoreans, 94.3',
          realspace_source: 'Warhammer 40,000: Mechanicus',
        },
        {
          text: 'We are derelict in our duty whenever we allow corruption to plague the minds of good men.',
          lore_source: 'Tech-Cosmos Verse 68',
          realspace_source: 'Warhammer 40,000: Mechanicus',
        },
        {
          text: 'From such small heresies are great apostasies made.',
          lore_source: 'Maxims Metalica, 76.12',
          realspace_source: 'Tech-Cosmos Verse 68',
        },
        {
          text: 'From the mouths of heretics emit naught but foul vapours. Cut out the tongue and be clean.',
          lore_source: 'Quaestos Mechanicor 5.21',
          realspace_source: 'Warhammer 40,000: Mechanicus',
        },
        {
          text: 'Better safe and ignorant, than rueing the means of our downfall.',
          lore_source: 'Macharian Notions, Chapter 4113',
          realspace_source: 'Warhammer 40,000: Mechanicus',
        },
        {
          text: 'Sometimes the weak limb must be amputated before the whole body withers.',
          lore_source: 'Selucian Aphorisms, Verse 539',
          realspace_source: 'Warhammer 40,000: Mechanicus',
        },
        {
          text: 'In each society there is a classification that is mirrored in another society.',
          lore_source: 'Scripture-Brother Magos Tech-Auxilium Prime, Know Thy Enemy, to Know Thyself',
          realspace_source: 'Warhammer 40,000: Mechanicus',
        },
        {
          text: 'When the heretic is silenced, it is as if his weapons and tools are stripped of him, he is left impotent and weak.',
          lore_source: 'Jovian Ministrations 61.90',
          realspace_source: 'Warhammer 40,000: Mechanicus',
        },
      ],
    };
  }

  render() {
    const quotationsList = this.state.quotations.map((q, idx) => {
      const style = {
        animationDelay: `${idx / 10}s`,
      };
      return (
        <div>
          <section className="quotation" style={style}>
            <q>{q.text}</q>
            <cite>{q.lore_source}</cite>
            <cite>{q.realspace_source}</cite>
          </section>
        </div>
      );
    });
    return quotationsList;
  }
}

export default QuotationsComponent;
