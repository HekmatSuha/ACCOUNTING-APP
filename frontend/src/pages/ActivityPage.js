import React, { useState, useEffect } from 'react';
import { Card, ListGroup, Spinner, Alert, Form, Button } from 'react-bootstrap';
import axiosInstance from '../utils/axiosInstance';

function ActivityPage() {
    const [activities, setActivities] = useState([]);
    const [selectedDate, setSelectedDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchByDate = async (date) => {
        try {
            setLoading(true);
            const response = await axiosInstance.get(`/activities/?date=${date}`);
            setActivities(response.data);
        } catch (err) {
            console.error('Failed to fetch activities:', err);
            setError('Could not load activities.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            try {
                const response = await axiosInstance.get('/activities/');
                if (response.data.length > 0) {
                    const latestDate = response.data[0].timestamp.split('T')[0];
                    setSelectedDate(latestDate);
                    await fetchByDate(latestDate);
                } else {
                    setActivities([]);
                    setLoading(false);
                }
            } catch (err) {
                console.error('Failed to fetch activities:', err);
                setError('Could not load activities.');
                setLoading(false);
            }
        };
        init();
    }, []);

    const handleShow = () => {
        if (selectedDate) {
            fetchByDate(selectedDate);
        }
    };

    if (loading) {
        return <Spinner animation="border" />;
    }

    if (error) {
        return <Alert variant="danger">{error}</Alert>;
    }

    return (
        <div>
            <h2 className="mb-4">Activity Log</h2>
            <Form className="mb-3 d-flex align-items-end">
                <Form.Group controlId="activityDate">
                    <Form.Label>Date</Form.Label>
                    <Form.Control type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                </Form.Group>
                <Button className="ms-2" onClick={handleShow}>Show</Button>
            </Form>
            <Card>
                <Card.Header>
                    <h5>Activities</h5>
                </Card.Header>
                <ListGroup variant="flush">
                    {activities.map(activity => (
                        <ListGroup.Item key={activity.id}>
                            <div><strong>{activity.user}</strong> {activity.description}</div>
                            <small className="text-muted">{new Date(activity.timestamp).toLocaleTimeString()}</small>
                        </ListGroup.Item>
                    ))}
                    {activities.length === 0 && (
                        <ListGroup.Item>No activities found.</ListGroup.Item>
                    )}
                </ListGroup>
            </Card>
        </div>
    );
}

export default ActivityPage;
