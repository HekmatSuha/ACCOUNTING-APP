import React, { useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Overlay } from 'react-bootstrap';
import { BsThreeDotsVertical } from 'react-icons/bs';
import './ActionMenu.css';

const buildClassName = (classes) => classes.filter(Boolean).join(' ');

function ActionMenu({ actions, align, className, menuClassName, toggleAriaLabel, id, ...rest }) {
    const generatedId = useId();
    const dropdownId = id || `action-menu-${generatedId}`;
    const dropdownClassName = buildClassName(['action-menu', className]);
    const menuClasses = buildClassName(['dropdown-menu show', 'action-menu-dropdown', menuClassName]);
    const [show, setShow] = useState(false);
    const toggleRef = useRef(null);
    const placement = (() => {
        if (typeof align === 'string') {
            return align === 'start' ? 'bottom-start' : 'bottom-end';
        }

        if (align && typeof align === 'object') {
            const directions = Object.values(align);
            if (directions.includes('start')) {
                return 'bottom-start';
            }
            if (directions.includes('end')) {
                return 'bottom-end';
            }
        }

        return 'bottom-end';
    })();

    const handleToggle = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setShow((previous) => !previous);
    };

    const handleHide = () => {
        setShow(false);
    };

    const handleItemClick = (event, action) => {
        event.stopPropagation();

        if (action.disabled) {
            event.preventDefault();
            return;
        }

        if (typeof action.onClick === 'function') {
            action.onClick(event);
        }

        if (!action.href) {
            event.preventDefault();
        }

        handleHide();
    };

    return (
        <div
            className={dropdownClassName}
            onClick={(e) => e.stopPropagation()}
            {...rest}
        >
            <Button
                ref={toggleRef}
                id={dropdownId}
                variant="light"
                size="sm"
                className="action-menu-toggle"
                aria-label={toggleAriaLabel}
                aria-expanded={show}
                aria-haspopup="true"
                onClick={handleToggle}
            >
                <span className="visually-hidden">{toggleAriaLabel}</span>
                <BsThreeDotsVertical aria-hidden="true" />
            </Button>
            <Overlay
                target={toggleRef.current}
                show={show}
                placement={placement}
                rootClose
                flip
                onHide={handleHide}
            >
                {({ ref, style, ...overlayProps }) => (
                    <div
                        ref={ref}
                        style={style}
                        className={menuClasses}
                        {...overlayProps}
                    >
                        {actions.map((action, index) => {
                            const itemKey = action.key ?? index;
                            const itemClasses = buildClassName([
                                'dropdown-item d-flex align-items-center gap-2',
                                action.variant,
                                action.disabled ? 'disabled' : '',
                            ]);
                            const ItemComponent = action.href ? 'a' : 'button';
                            const itemProps = action.href ? { href: action.href } : { type: 'button' };

                            return (
                                <ItemComponent
                                    key={itemKey}
                                    className={itemClasses}
                                    {...itemProps}
                                    onClick={(event) => handleItemClick(event, action)}
                                    {...(action.disabled ? { tabIndex: -1, 'aria-disabled': true } : {})}
                                >
                                    {action.icon && <span className="action-menu-item-icon">{action.icon}</span>}
                                    <span>{action.label}</span>
                                </ItemComponent>
                            );
                        })}
                    </div>
                )}
            </Overlay>
        </div>
    );
}

ActionMenu.propTypes = {
    actions: PropTypes.arrayOf(PropTypes.shape({
        label: PropTypes.string.isRequired,
        icon: PropTypes.node,
        variant: PropTypes.string,
        onClick: PropTypes.func,
        disabled: PropTypes.bool,
        href: PropTypes.string,
        key: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    })).isRequired,
    align: PropTypes.oneOfType([
        PropTypes.oneOf(['start', 'end']),
        PropTypes.object,
    ]),
    className: PropTypes.string,
    menuClassName: PropTypes.string,
    toggleAriaLabel: PropTypes.string,
    id: PropTypes.string,
};

ActionMenu.defaultProps = {
    align: 'end',
    className: '',
    menuClassName: '',
    toggleAriaLabel: 'Open actions menu',
    id: undefined,
};

export default ActionMenu;
