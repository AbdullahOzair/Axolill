export const BOOK_CALL_PARAM = "book";
export const BOOK_CALL_CALLBACK = `/?${BOOK_CALL_PARAM}=1`;
export const BOOK_CALL_LOGIN = `/login?next=${encodeURIComponent(BOOK_CALL_CALLBACK)}`;
