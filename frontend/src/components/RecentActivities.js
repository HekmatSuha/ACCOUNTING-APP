import React, { useState, useEffect } from 'react';
import { Card, ListGroup, Button, Spinner, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { FaUndo } from 'react-icons/fa';

function RecentActivities() {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const visibleCount = 5;
    const navigate = useNavigate();

    const fetchActivities = async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get('/activities/');
            setActivities(response.data);
        } catch (err) {
            console.error("Failed to fetch activities:", err);
            setError('Could not load recent activities.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActivities();
    }, []);

    const handleUndo = async (activityId) => {
        try {
            await axiosInstance.post(`/activities/${activityId}/restore/`);
            // Refresh the activities list to show the change
            fetchActivities();
        } catch (err) {
            console.error("Failed to undo activity:", err);
            setError('Could not undo the action. Please try again.');
        }
    };

    const showMore = () => {
        navigate('/activities');
    };

    if (loading) {
        return <Spinner animation="border" />;
    }

    if (error) {
        return <Alert variant="danger">{error}</Alert>;
    }

    return (
        <Card className="mt-4">
            <Card.Header>
                <h4>Recent Activities</h4>
            </Card.Header>
            <ListGroup variant="flush">
                {activities.slice(0, visibleCount).map(activity => (
                    <ListGroup.Item key={activity.id} className="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>{activity.user}</strong> {activity.description}
                            <br />
                            <small className="text-muted">{new Date(activity.timestamp).toLocaleString()}</small>
                        </div>
                        {activity.action_type === 'deleted' && (
                            <Button variant="outline-secondary" size="sm" onClick={() => handleUndo(activity.id)}>
                                <FaUndo /> Undo
                            </Button>
                        )}
                    </ListGroup.Item>
                ))}
            </ListGroup>
            {activities.length > visibleCount && (
                <Card.Footer className="text-center">
                    <Button variant="primary" onClick={showMore}>Show More</Button>
                </Card.Footer>
            )}
        </Card>
    );
}

export default RecentActivities;
