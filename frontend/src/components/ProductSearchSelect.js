// frontend/src/components/ProductSearchSelect.js

import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Form, InputGroup, ListGroup, Image } from 'react-bootstrap';
import { Search } from 'react-bootstrap-icons';

const MAX_RESULTS = 8;

const formatProductLabel = (product) => {
    if (!product) return '';
    return product.sku ? `${product.name} · ${product.sku}` : product.name;
};

function ProductSearchSelect({ products, value, onSelect, placeholder, imageBaseUrl }) {
    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (value) {
            setQuery(formatProductLabel(value));
        } else {
            setQuery('');
        }
    }, [value]);

    const filteredProducts = useMemo(() => {
        const term = query.trim().toLowerCase();
        if (!term) {
            return products.slice(0, MAX_RESULTS);
        }
        return products
            .filter((product) => {
                const name = product.name?.toLowerCase?.() || '';
                const sku = product.sku?.toLowerCase?.() || '';
                return name.includes(term) || sku.includes(term);
            })
            .slice(0, MAX_RESULTS);
    }, [products, query]);

    const handleSelect = (product) => {
        onSelect(product);
        setQuery(formatProductLabel(product));
        setIsFocused(false);
    };

    return (
        <div className="product-search-select">
            <InputGroup>
                <InputGroup.Text>
                    <Search />
                </InputGroup.Text>
                <Form.Control
                    type="search"
                    placeholder={placeholder}
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setIsFocused(true);
                    }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                    aria-label="Search product"
                />
            </InputGroup>
            {isFocused && filteredProducts.length > 0 && (
                <ListGroup className="product-search-select__results shadow-sm">
                    {filteredProducts.map((product) => {
                        const resolvedImage = product.image
                            ? (product.image.startsWith('http')
                                ? product.image
                                : `${imageBaseUrl || ''}${product.image}`)
                            : null;
                        return (
                            <ListGroup.Item
                                action
                                key={product.id}
                                onMouseDown={() => handleSelect(product)}
                                className="d-flex align-items-center gap-2"
                            >
                                {resolvedImage && (
                                    <Image
                                        src={resolvedImage}
                                        alt={product.name}
                                        thumbnail
                                        rounded
                                        width={40}
                                        height={40}
                                        onError={(event) => {
                                            event.target.style.display = 'none';
                                        }}
                                    />
                                )}
                                <div>
                                    <div className="fw-semibold">{product.name}</div>
                                    <div className="text-muted small">{product.sku ? `SKU: ${product.sku}` : 'No SKU'}</div>
                                </div>
                            </ListGroup.Item>
                        );
                    })}
                </ListGroup>
            )}
        </div>
    );
}

ProductSearchSelect.propTypes = {
    products: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.number.isRequired,
            name: PropTypes.string.isRequired,
            sku: PropTypes.string,
            image: PropTypes.string,
        })
    ).isRequired,
    value: PropTypes.shape({
        id: PropTypes.number,
        name: PropTypes.string,
        sku: PropTypes.string,
        image: PropTypes.string,
    }),
    onSelect: PropTypes.func.isRequired,
    placeholder: PropTypes.string,
    imageBaseUrl: PropTypes.string,
};

ProductSearchSelect.defaultProps = {
    value: null,
    placeholder: 'Search product',
    imageBaseUrl: '',
};

export default ProductSearchSelect;
