import { ImageSourcePropType } from 'react-native';

export interface MenuItem {
  label: string;
  price: number;
  icon?: ImageSourcePropType;
}

export interface SubCategory {
  label: string;
  color: string;
  isDirectItem?: boolean; // If true, shows "ADD +" button on Screen 2
  icon?: ImageSourcePropType;
  items: MenuItem[];
}

export interface Category {
  label: string;
  color: string;
  icon: ImageSourcePropType;
  subCategories: SubCategory[];
}

export const categories: Category[] = [
  {
    label: 'Chinese',
    color: '#B9A0D5',
    icon: require('../assets/icons/chinese.png'),
    subCategories: [
      {
        label: 'Rice',
        color: '#C4AEDD',
        items: [
          { label: 'Fried Rice', price: 850 },
          { label: 'Steam Rice', price: 650 },
          { label: 'Egg Fried Rice', price: 750 },
        ],
      },
      {
        label: 'Noodles',
        color: '#B9A0D5',
        items: [
          { label: 'Veg Noodles', price: 700 },
          { label: 'Chicken Noodles', price: 850 },
        ],
      },
    ],
  },
  {
    label: 'Indian',
    color: '#8D9ED4',
    icon: require('../assets/icons/indian.png'),
    subCategories: [
      {
        label: 'Curries',
        color: '#9DB0E0',
        items: [
          { label: 'Butter Chicken', price: 1200 },
          { label: 'Paneer Curry', price: 950 },
        ],
      },
      {
        label: 'Rice & Bread',
        color: '#8D9ED4',
        items: [
          { label: 'Biryani', price: 1100 },
          { label: 'Naan', price: 200 },
        ],
      },
    ],
  },
  {
    label: 'Pantry',
    color: '#D5CD91',
    icon: require('../assets/icons/pantry.png'),
    subCategories: [
      {
        label: 'Bakery',
        color: '#DCDAA0',
        items: [
          { label: 'Croissant', price: 350 },
          { label: 'Muffin', price: 300 },
        ],
      },
      {
        label: 'Sandwiches',
        color: '#D5CD91',
        items: [
          { label: 'Veg Sandwich', price: 450 },
          { label: 'Club Sandwich', price: 650 },
        ],
      },
    ],
  },
  {
    label: 'Juice Bar',
    color: '#D5B0B0',
    icon: require('../assets/icons/juice.png'),
    subCategories: [
      {
        label: 'Cool Refresh',
        color: '#B9A0D5',
        icon: require('../assets/icons/juice.png'),
        items: [
          { label: 'Orange Juice', price: 380 },
          { label: 'Mango Juice', price: 380 },
        ],
      },
      {
        label: 'Moctails',
        color: '#8D9ED4',
        icon: require('../assets/icons/juice.png'),
        items: [
          { label: 'Blue Lagoon', price: 550 },
          { label: 'Sunrise', price: 520 },
        ],
      },
      // Direct Items (as shown in your screenshot)
      {
        label: 'Chai (Tea)',
        color: '#FFFFFF',
        isDirectItem: true,
        icon: require('../assets/icons/juice.png'),
        items: [{ label: 'Chai (Tea)', price: 250 }],
      },
      {
        label: 'Nescafe',
        color: '#FFFFFF',
        isDirectItem: true,
        icon: require('../assets/icons/juice.png'),
        items: [{ label: 'Nescafe', price: 300 }],
      },
      {
        label: 'Lemon Tea',
        color: '#FFFFFF',
        isDirectItem: true,
        icon: require('../assets/icons/juice.png'),
        items: [{ label: 'Lemon Tea', price: 280 }],
      },
    ],
  },
  {
    label: 'Soft Drink',
    color: '#CDBCA8',
    icon: require('../assets/icons/softdrinks.png'),
    subCategories: [
      {
        label: 'Canned',
        color: '#D5C0B0',
        items: [
          { label: 'Coca Cola', price: 200 },
          { label: 'Pepsi', price: 200 },
        ],
      },
    ],
  },
  {
    label: 'Other',
    color: '#A9ABCF',
    icon: require('../assets/icons/more.png'),
    subCategories: [
      {
        label: 'Desserts',
        color: '#B8BADC',
        items: [
          { label: 'Ice Cream', price: 400 },
          { label: 'Pudding', price: 380 },
        ],
      },
    ],
  },
];