interface Example {
  title: string;
  participants: string[];
}

export const EXAMPLES: Example[] = [
  {
    title: 'Who tells Nan about the divorce',
    participants: ['Mum', 'Dad', 'Auntie Sue', 'Cousin Gemma (her favourite)'],
  },
  {
    title: 'Who cleans out the office fridge',
    participants: ['Priya', 'Tom', 'Dave (again)', 'Sandra from Accounts'],
  },
  {
    title: "Who reads Uncle Derek's eulogy",
    participants: ['Cousin Mark', 'Auntie Pat', 'Big Terry from the pub', 'His bookie'],
  },
  {
    title: 'Designated driver for the stag do',
    participants: ['Gaz', 'Big Steve', 'Little Steve', "The groom's dad", 'The groom (nice try)'],
  },
  {
    title: "Who tells Jez he's out of the band",
    participants: ['Rich', 'Sophie', 'Mike', 'Our manager, technically'],
  },
  {
    title: 'Where we scatter Grandad',
    participants: ['Blackpool pier', 'The allotment', 'Villa Park', 'Behind the Crown & Anchor'],
  },
  {
    title: 'Takeaway, since nobody decides',
    participants: ['Curry', 'Chippy', 'The dodgy kebab van', 'Toast, again'],
  },
  {
    title: 'What we call the new cat',
    participants: ['Gary', 'Mrs Miggins', 'Clement Attlee', 'Pasta'],
  },
  {
    title: 'Which pub for the leaving do',
    participants: ['The Red Lion', 'The other Red Lion', "The King's Head", 'Wetherspoons (sorry)'],
  },
  {
    title: "Book club: next month's pick",
    participants: ['Middlemarch', 'Wolf Hall', 'The Da Vinci Code (ironically)', "Clive's self-published memoir"],
  },
  {
    title: 'Film night, and no arguing',
    participants: ['Paddington 2', 'Withnail and I', 'The Godfather Part III', 'Cats (2019)'],
  },
  {
    title: 'Which team gets restructured',
    participants: ['Marketing', 'IT', 'Facilities', "The new CFO's nephew"],
  },
  {
    title: 'Where we go on holiday this year',
    participants: ['Skegness', 'Magaluf', 'Lisbon', "Nan's caravan in Rhyl"],
  },
  {
    title: 'Who gets the spare room at Xmas',
    participants: ['Aunt Linda', 'Grandpa Jim', 'Chloe and the new boyfriend', 'The dog'],
  },
  {
    title: 'What we sell to pay the gas bill',
    participants: ['The PlayStation', 'The good telly', "Nan's silver", 'The car (worth £40)'],
  },
];

export function randomExample(): Example {
  return EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
}
