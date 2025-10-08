import { useCallback, useReducer } from 'react';

const initialState = {
    show: false,
    index: null,
    initialItem: null,
};

function reducer(state, action) {
    switch (action.type) {
        case 'OPEN_CREATE':
            return {
                show: true,
                index: null,
                initialItem: action.payload || null,
            };
        case 'OPEN_EDIT':
            return {
                show: true,
                index: action.payload.index,
                initialItem: action.payload.item,
            };
        case 'CLOSE':
            return initialState;
        default:
            return state;
    }
}

export default function useSaleItemModal() {
    const [state, dispatch] = useReducer(reducer, initialState);

    const openCreate = useCallback((defaultItem = null) => {
        dispatch({ type: 'OPEN_CREATE', payload: defaultItem });
    }, []);

    const openEdit = useCallback((index, item) => {
        dispatch({ type: 'OPEN_EDIT', payload: { index, item } });
    }, []);

    const close = useCallback(() => {
        dispatch({ type: 'CLOSE' });
    }, []);

    return {
        state,
        openCreate,
        openEdit,
        close,
    };
}
