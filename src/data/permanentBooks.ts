import { UserBook } from '../types';
import rawData from './permanentBooks.json';

export const PERMANENT_BOOKS: UserBook[] = rawData as UserBook[];

export default PERMANENT_BOOKS;
