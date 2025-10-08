import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Badge,
    Button,
    Card,
    Col,
    Form,
    Row,
    Spinner
} from 'react-bootstrap';
import { Calendar3, ClockHistory } from 'react-bootstrap-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import axiosInstance from '../utils/axiosInstance';
import '../styles/activity-log.css';

dayjs.extend(relativeTime);

const formatDateLabel = (date) => {
    const parsed = dayjs(date);
    return parsed.isValid() ? parsed.format('dddd, MMM D, YYYY') : 'Select a date';
};

const formatTime = (timestamp) => {
    const parsed = dayjs(timestamp);
    return parsed.isValid() ? parsed.format('h:mm A') : '--';
};

const formatRelativeTime = (timestamp) => {
    const parsed = dayjs(timestamp);
    return parsed.isValid() ? parsed.fromNow() : '';
};

const getInitials = (value = '') => {
    const trimmed = value.trim();
    if (!trimmed) {
        return '??';
    }

    const parts = trimmed.split(/\s+/).slice(0, 2);
    return parts.map((part) => part[0]).join('').toUpperCase();
};

function ActivityPage() {
    const [activities, setActivities] = useState([]);
    const [availableDates, setAvailableDates] = useState([]);
    const [selectedDate, setSelectedDate] = useState('');
    const [inputDate, setInputDate] = useState('');
    const [initialLoading, setInitialLoading] = useState(true);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchByDate = useCallback(async (date, options = {}) => {
        const { skipSpinner = false } = options;

        if (!date) {
            setActivities([]);
            return;
        }

        setError('');

        try {
            if (!skipSpinner) {
                setTimelineLoading(true);
            }

            const response = await axiosInstance.get('/activities/', { params: { date } });
            const data = Array.isArray(response.data) ? response.data : [];
            setActivities(data);
        } catch (err) {
            console.error('Failed to fetch activities:', err);
            setError('Could not load activities.');
            setActivities([]);
        } finally {
            if (!skipSpinner) {
                setTimelineLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        const initialiseActivities = async () => {
            try {
                setInitialLoading(true);
                const response = await axiosInstance.get('/activities/');
                const data = Array.isArray(response.data) ? response.data : [];

                const uniqueDates = Array.from(
                    new Set(
                        data
                            .map((item) => item.timestamp && item.timestamp.split('T')[0])
                            .filter(Boolean)
                    )
                ).sort((a, b) => dayjs(b).valueOf() - dayjs(a).valueOf());

                setAvailableDates(uniqueDates);

                if (uniqueDates.length > 0) {
                    const latestDate = uniqueDates[0];
                    setSelectedDate(latestDate);
                    setInputDate(latestDate);

                    const todaysActivities = data.filter(
                        (item) => item.timestamp && item.timestamp.startsWith(latestDate)
                    );

                    if (todaysActivities.length > 0) {
                        setActivities(todaysActivities);
                    } else {
                        await fetchByDate(latestDate, { skipSpinner: true });
                    }
                } else {
                    setActivities([]);
                }

                setError('');
            } catch (err) {
                console.error('Failed to fetch activities:', err);
                setError('Could not load activities.');
                setActivities([]);
            } finally {
                setInitialLoading(false);
            }
        };

        initialiseActivities();
    }, [fetchByDate]);

    const handleSubmit = (event) => {
        event.preventDefault();

        if (!inputDate) {
            return;
        }

        setSelectedDate(inputDate);
        fetchByDate(inputDate);
    };

    const handleQuickSelect = (event) => {
        const value = event.target.value;
        setInputDate(value);

        if (value) {
            setSelectedDate(value);
            fetchByDate(value);
        } else {
            setActivities([]);
        }
    };

    const isLoading = initialLoading || timelineLoading;
    const activityCount = activities.length;
    const formattedSelectedDate = formatDateLabel(selectedDate);

    const uniqueUserCount = useMemo(() => {
        const uniqueUsers = new Set();

        activities.forEach((activity) => {
            const user = (activity.user || '').trim();
            uniqueUsers.add(user || 'Unknown user');
        });

        return uniqueUsers.size;
    }, [activities]);

    return (
        <div className="activity-page">
            <div className="activity-page__header">
                <div>
                    <h2 className="activity-page__title mb-1">Activity Log</h2>
                    <p className="activity-page__subtitle mb-0 text-muted">
                        Track the latest actions recorded across your workspace.
                    </p>
                </div>
                <div className="activity-insight-card">
                    <div className="activity-insight-icon">
                        <ClockHistory size={22} />
                    </div>
                    <div>
                        <span className="activity-insight-label">Entries</span>
                        <h4 className="activity-insight-value mb-0">{activityCount}</h4>
                        <div className="activity-insight-meta">
                            <Badge bg="light" text="dark">
                                {uniqueUserCount} {uniqueUserCount === 1 ? 'user' : 'users'}
                            </Badge>
                            <span>{formattedSelectedDate}</span>
                        </div>
                    </div>
                </div>
            </div>

            {error && !isLoading && (
                <Alert variant="danger" className="mb-3">
                    {error}
                </Alert>
            )}

            <Card className="activity-filter-card">
                <Card.Body>
                    <Form onSubmit={handleSubmit} className="activity-filter-form">
                        <Row className="g-3 align-items-end">
                            <Col xs={12} md={4}>
                                <Form.Label htmlFor="activity-date" className="fw-semibold">
                                    Filter by date
                                </Form.Label>
                                <Form.Control
                                    id="activity-date"
                                    type="date"
                                    value={inputDate}
                                    max={availableDates[0] || ''}
                                    onChange={(event) => setInputDate(event.target.value)}
                                />
                            </Col>
                            {availableDates.length > 0 && (
                                <Col xs={12} md={4}>
                                    <Form.Label className="fw-semibold">Quick select</Form.Label>
                                    <Form.Select value={selectedDate} onChange={handleQuickSelect}>
                                        {availableDates.map((dateOption) => (
                                            <option key={dateOption} value={dateOption}>
                                                {formatDateLabel(dateOption)}
                                            </option>
                                        ))}
                                    </Form.Select>
                                </Col>
                            )}
                            <Col xs={12} md={4} className="text-md-end">
                                <Button
                                    type="submit"
                                    variant="primary"
                                    className="px-4"
                                    disabled={isLoading || !inputDate}
                                >
                                    {isLoading ? 'Loading…' : 'Show activity'}
                                </Button>
                            </Col>
                        </Row>
                    </Form>
                </Card.Body>
            </Card>

            <Card className="activity-timeline-card">
                <Card.Header className="activity-timeline-card__header">
                    <div>
                        <span className="activity-timeline-card__eyebrow">Timeline</span>
                        <h5 className="mb-0">Updates for {formattedSelectedDate}</h5>
                    </div>
                    <Badge bg="primary" className="activity-timeline-count">
                        {activityCount} {activityCount === 1 ? 'entry' : 'entries'}
                    </Badge>
                </Card.Header>
                <Card.Body>
                    {isLoading ? (
                        <div className="activity-timeline-empty text-center py-5">
                            <Spinner animation="border" />
                            <p className="text-muted mt-3 mb-0">Loading activity…</p>
                        </div>
                    ) : error ? (
                        <Alert variant="danger" className="mb-0">
                            {error}
                        </Alert>
                    ) : activityCount > 0 ? (
                        <div className="activity-timeline">
                            {activities.map((activity, index) => {
                                const userName = activity.user || 'Unknown user';
                                const description = activity.description || 'No additional details provided.';
                                const timestamp = activity.timestamp;
                                const timeLabel = formatTime(timestamp);
                                const relativeLabel = formatRelativeTime(timestamp);
                                const key = activity.id ?? `${timestamp}-${index}`;

                                return (
                                    <div className="activity-timeline__item" key={key}>
                                        <div className="activity-timeline__card">
                                            <div className="activity-timeline__avatar">{getInitials(userName)}</div>
                                            <div className="activity-timeline__content">
                                                <div className="activity-timeline__content-header">
                                                    <div>
                                                        <span className="activity-timeline__user">{userName}</span>
                                                        <p className="activity-timeline__description mb-1">{description}</p>
                                                    </div>
                                                    {relativeLabel && (
                                                        <span className="activity-timeline__relative">{relativeLabel}</span>
                                                    )}
                                                </div>
                                                <div className="activity-timeline__meta">
                                                    <ClockHistory size={16} />
                                                    <span>{timeLabel}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="activity-empty-state text-center py-5">
                            <div className="activity-empty-icon">
                                <Calendar3 size={24} />
                            </div>
                            <h6 className="mt-3 mb-1">No activity recorded</h6>
                            <p className="text-muted mb-0">Try choosing a different date or check back later.</p>
                        </div>
                    )}
                </Card.Body>
            </Card>
        </div>
    );
}

export default ActivityPage;
