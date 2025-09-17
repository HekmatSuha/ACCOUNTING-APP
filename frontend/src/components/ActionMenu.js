import React, { useId } from 'react';
import PropTypes from 'prop-types';
import { Dropdown } from 'react-bootstrap';
import { BsThreeDotsVertical } from 'react-icons/bs';
import './ActionMenu.css';

const buildClassName = (classes) => classes.filter(Boolean).join(' ');

function ActionMenu({ actions, align, className, menuClassName, toggleAriaLabel, stopPropagation, id, ...rest }) {
    const generatedId = useId();
    const dropdownId = id || `action-menu-${generatedId}`;
    const dropdownClassName = buildClassName(['action-menu', className]);
    const menuClasses = buildClassName(['action-menu-dropdown', menuClassName]);
    const handleClickCapture = stopPropagation ? (event) => event.stopPropagation() : undefined;

    return (
        <Dropdown
            align={align}
            className={dropdownClassName}
            onClickCapture={handleClickCapture}
            {...rest}
        >
            <Dropdown.Toggle
                id={dropdownId}
                variant="light"
                size="sm"
                className="action-menu-toggle"
                aria-label={toggleAriaLabel}
            >
                <span className="visually-hidden">{toggleAriaLabel}</span>
                <BsThreeDotsVertical aria-hidden="true" />
            </Dropdown.Toggle>
            <Dropdown.Menu className={menuClasses}>
                {actions.map((action, index) => {
                    const itemKey = action.key ?? index;
                    const itemClasses = buildClassName([
                        'd-flex align-items-center gap-2',
                        action.variant,
                    ]);
                    const itemProps = action.href ? { href: action.href } : {};

                    return (
                        <Dropdown.Item
                            key={itemKey}
                            className={itemClasses}
                            disabled={action.disabled}
                            {...itemProps}
                            onClick={(event) => {
                                if (typeof action.onClick === 'function') {
                                    action.onClick(event);
                                }
                            }}
                        >
                            {action.icon && <span className="action-menu-item-icon">{action.icon}</span>}
                            <span>{action.label}</span>
                        </Dropdown.Item>
                    );
                })}
            </Dropdown.Menu>
        </Dropdown>
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
    stopPropagation: PropTypes.bool,
    id: PropTypes.string,
};

ActionMenu.defaultProps = {
    align: 'end',
    className: '',
    menuClassName: '',
    toggleAriaLabel: 'Open actions menu',
    stopPropagation: false,
    id: undefined,
};

export default ActionMenu;
