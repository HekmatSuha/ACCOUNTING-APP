import json
from django.contrib.contenttypes.models import ContentType
from .models import Activity

def log_activity(user, action_type, instance):
    """
    Logs an activity for a given model instance.
    """
    description = f'{instance.__class__.__name__} {instance} was {action_type}.'
    object_repr = ''
    if action_type == 'deleted':
        # For deletions, serialize the object's data for potential restoration
        from django.core import serializers
        object_repr = serializers.serialize('json', [instance])

    Activity.objects.create(
        user=user,
        action_type=action_type,
        description=description,
        content_type=ContentType.objects.get_for_model(instance),
        object_id=instance.pk,
        object_repr=object_repr
    )
