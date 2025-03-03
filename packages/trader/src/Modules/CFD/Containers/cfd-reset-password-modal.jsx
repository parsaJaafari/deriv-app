import { Formik } from 'formik';
import * as PropTypes from 'prop-types';
import React from 'react';
import { withRouter } from 'react-router-dom';
import { Button, Icon, PasswordMeter, PasswordInput, FormSubmitButton, Loading, Modal, Text } from '@deriv/components';
import {
    routes,
    validLength,
    validPassword,
    getErrorMessages,
    CFD_PLATFORMS,
    WS,
    redirectToLogin,
} from '@deriv/shared';
import { localize, Localize, getLanguage } from '@deriv/translations';
import { connect } from 'Stores/connect';
import { getMtCompanies } from 'Stores/Modules/CFD/Helpers/cfd-config';

const ResetPasswordIntent = ({ current_list, children, is_eu, ...props }) => {
    const reset_password_intent = localStorage.getItem('cfd_reset_password_intent');
    const reset_password_type = localStorage.getItem('cfd_reset_password_type') || 'main'; // Default to main
    const has_intent =
        reset_password_intent && /(real|demo)\.(financial_stp|financial|synthetic)/.test(reset_password_intent);

    let group, type, login, title, server;
    if (has_intent && current_list) {
        [server, group, type] = reset_password_intent.split('.');
        login = current_list[`mt5.${group}.${type}@${server}`].login;
        title = getMtCompanies(is_eu)[group][type].title;
    } else if (current_list) {
        [server, group, type] = Object.keys(current_list).pop().split('.');
        login = current_list[`mt5.${group}.${type}@${server}`]?.login ?? '';
        title = getMtCompanies(is_eu)?.[group]?.[type]?.title ?? '';
    } else {
        // Set a default intent
        login = '';
        title = '';
    }

    return children({
        login,
        title,
        type: reset_password_type,
        ...props,
    });
};

const CFDResetPasswordModal = ({
    current_list,
    email,
    is_cfd_reset_password_modal_enabled,
    is_eu,
    is_logged_in,
    platform,
    setCFDPasswordResetModal,
    history,
}) => {
    const [state, setState] = React.useState({
        error_code: undefined,
        has_error: false,
        error_message: undefined,
        is_finished: false,
        changed_password_type: '',
    });

    const renderErrorBox = error => {
        setState({
            ...state,
            error_code: error.code,
            has_error: true,
            error_message: error.message,
        });
    };
    const clearAddressBar = () => {
        localStorage.removeItem('cfd_reset_password_intent');
        localStorage.removeItem('cfd_reset_password_type');
        localStorage.removeItem('cfd_reset_password_code');
        history.push(`${routes.mt5}`);
    };
    const validatePassword = values => {
        const errors = {};

        if (
            !validLength(values.new_password, {
                min: 8,
                max: 25,
            })
        ) {
            errors.new_password = localize('You should enter {{min_number}}-{{max_number}} characters.', {
                min_number: 8,
                max_number: 25,
            });
        } else if (!validPassword(values.new_password)) {
            errors.new_password = getErrorMessages().password();
        }
        if (values.new_password.toLowerCase() === email.toLowerCase()) {
            errors.new_password = localize('Your password cannot be the same as your email address.');
        }

        return errors;
    };
    const resetPassword = (values, password_type, login, actions) => {
        const { setSubmitting } = actions;
        setSubmitting(true);
        const request = {
            account_id: login,
            platform: CFD_PLATFORMS.MT5,
            new_password: values.new_password,
            verification_code: localStorage.getItem('cfd_reset_password_code'),
        };

        WS.tradingPlatformInvestorPasswordReset(request).then(response => {
            if (response.error && (response.error.code === 'InvalidToken' || response.error.code === 'BadSession')) {
                renderErrorBox(response.error);
            } else {
                setState({
                    ...state,
                    is_finished: true,
                    changed_password_type: password_type,
                });
                clearAddressBar();
            }
            setSubmitting(false);
        });
    };
    const getIsListFetched = () => {
        return Object.keys(current_list).length !== 0;
    };

    const is_invalid_investor_token = !getIsListFetched() && localStorage.getItem('cfd_reset_password_code');

    return (
        <Modal
            className='cfd-reset-password-modal'
            is_open={is_cfd_reset_password_modal_enabled && !is_invalid_investor_token}
            toggleModal={() => setCFDPasswordResetModal(false)}
            title={
                platform === CFD_PLATFORMS.DXTRADE
                    ? localize('Reset Deriv X investor password')
                    : localize('Reset DMT5 investor password')
            }
            onMount={() => redirectToLogin(is_logged_in, getLanguage(), true)}
        >
            {!getIsListFetched() && !state.has_error && <Loading is_fullscreen={false} />}
            {getIsListFetched() && !state.has_error && !state.is_finished && (
                <ResetPasswordIntent current_list={current_list} is_eu={is_eu}>
                    {({ type, login }) => (
                        <Formik
                            initialValues={{ new_password: '' }}
                            validate={validatePassword}
                            onSubmit={(values, actions) => resetPassword(values, type, login, actions)}
                        >
                            {({ handleSubmit, errors, values, isSubmitting, handleChange, handleBlur, touched }) => (
                                <form autoComplete='off' onSubmit={handleSubmit}>
                                    <div className='cfd-reset-password'>
                                        <div className='cfd-reset-password__container'>
                                            <div className='cfd-reset-password__password-area'>
                                                <PasswordMeter
                                                    input={values.new_password}
                                                    has_error={!!(touched.new_password && errors.new_password)}
                                                    custom_feedback_messages={getErrorMessages().password_warnings}
                                                >
                                                    {({ has_warning }) => (
                                                        <PasswordInput
                                                            autoComplete='new-password'
                                                            className='cfd-reset-password__password-field'
                                                            name='new_password'
                                                            label={localize('New {{type}} password', { type })}
                                                            onChange={handleChange}
                                                            onBlur={handleBlur}
                                                            error={touched.new_password && errors.new_password}
                                                            value={values.new_password}
                                                            data-lpignore='true'
                                                            required
                                                            hint={
                                                                !has_warning &&
                                                                localize(
                                                                    'Strong passwords contain at least 8 characters, combine uppercase and lowercase letters, numbers, and symbols.'
                                                                )
                                                            }
                                                        />
                                                    )}
                                                </PasswordMeter>
                                            </div>
                                            {isSubmitting && <Loading is_fullscreen={false} />}
                                            {!isSubmitting && (
                                                <FormSubmitButton
                                                    is_disabled={
                                                        isSubmitting ||
                                                        !values.new_password ||
                                                        Object.keys(errors).length > 0
                                                    }
                                                    errors={errors}
                                                    is_center={true}
                                                    large
                                                    label={localize('Create {{type}} password', { type })}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </form>
                            )}
                        </Formik>
                    )}
                </ResetPasswordIntent>
            )}
            {state.has_error && (
                <div className='cfd-reset-password__error'>
                    <Icon icon='IcMt5Expired' size={128} />
                    <Text as='p' size='xs' weight='bold' align='center' className='cfd-reset-password__heading'>
                        {state.error_message}
                    </Text>
                    {state.error_code === 'InvalidToken' && (
                        <Text
                            as='p'
                            color='prominent'
                            size='xs'
                            align='center'
                            className='cfd-reset-password__description--is-centered'
                        >
                            <Localize i18n_default_text='Please request a new password and check your email for the new token.' />
                        </Text>
                    )}
                    <Button
                        primary
                        large
                        className='cfd-reset-password__confirm-button'
                        onClick={() => {
                            clearAddressBar();
                            setCFDPasswordResetModal(false);
                        }}
                    >
                        <Localize i18n_default_text='Ok' />
                    </Button>
                </div>
            )}
            {state.is_finished && (
                <div className='cfd-reset-password__success'>
                    <Icon icon='IcMt5PasswordUpdated' size={128} />
                    <div className='cfd-reset-password__description'>
                        <Localize
                            i18n_default_text='Your {{account_type}} password has been changed.'
                            values={{
                                account_type:
                                    state.changed_password_type === 'main' ? localize('main') : localize('investor'),
                            }}
                        />
                    </div>
                    <Button primary large onClick={() => setCFDPasswordResetModal(false)}>
                        <Localize i18n_default_text='Ok' />
                    </Button>
                </div>
            )}
        </Modal>
    );
};

CFDResetPasswordModal.propTypes = {
    email: PropTypes.string,
    is_eu: PropTypes.bool,
    is_cfd_reset_password_modal_enabled: PropTypes.any,
    setCFDPasswordResetModal: PropTypes.any,
    current_list: PropTypes.any,
};

export default React.memo(
    withRouter(
        connect(({ modules: { cfd }, client }) => ({
            email: client.email,
            is_eu: client.is_eu,
            is_cfd_reset_password_modal_enabled: cfd.is_cfd_reset_password_modal_enabled,
            setCFDPasswordResetModal: cfd.setCFDPasswordResetModal,
            current_list: cfd.current_list,
            is_logged_in: client.is_logged_in,
        }))(CFDResetPasswordModal)
    )
);
