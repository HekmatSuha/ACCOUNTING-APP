import json
from django.contrib.contenttypes.models import ContentType
from django.core import serializers
from .models import Activity, Sale, Purchase

def log_activity(user, action_type, instance):
    """
    Logs an activity for a given model instance.
    For deletions, it stores a JSON representation of the object for restoration.
    """
    description = f'{instance.__class__.__name__} {instance} was {action_type}.'
    object_repr = ''

    if action_type == 'deleted':
        if isinstance(instance, Sale):
            items_data = serializers.serialize('json', instance.items.all())
            sale_data = serializers.serialize('json', [instance])
            object_repr = json.dumps({'sale': sale_data, 'items': items_data})
        elif isinstance(instance, Purchase):
            items_data = serializers.serialize('json', instance.items.all())
            purchase_data = serializers.serialize('json', [instance])
            object_repr = json.dumps({'purchase': purchase_data, 'items': items_data})
        else:
            object_repr = serializers.serialize('json', [instance])

    Activity.objects.create(
        user=user,
        action_type=action_type,
        description=description,
        content_type=ContentType.objects.get_for_model(instance),
        object_id=instance.pk,
        object_repr=object_repr
    )
