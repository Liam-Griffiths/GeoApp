// noinspection JSUnusedGlobalSymbols

import * as ngeohash from 'ngeohash';
import { DynamoDB } from 'aws-sdk';

const dynamoDb = new DynamoDB.DocumentClient();
const tableName = process.env.LOCATIONS_TABLE;

interface NewLocation {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
        const requestBody = JSON.parse(event.body);

        const newLocation: NewLocation = {
            id: requestBody.id,
            name: requestBody.name,
            latitude: requestBody.latitude,
            longitude: requestBody.longitude,
        };

        await addLocation(newLocation);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Location added successfully' }),
        };
    } catch (error) {
        console.error(error);

        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'An error occurred while processing your request' }),
        };
    }
}

async function addLocation(location: NewLocation): Promise<void> {
    const geohash = ngeohash.encode(location.latitude, location.longitude);

    const item: Location & { geohash: string } = {
        ...location,
        geohash,
    };

    await dynamoDb
        .put({
            TableName: tableName,
            Item: item,
        })
        .promise();
}