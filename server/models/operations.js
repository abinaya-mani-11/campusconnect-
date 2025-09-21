import database from '../config/database.js';
import { ObjectId } from 'mongodb';

export async function findFacultyByEmail(email) {
    return await database.faculty().findOne({ email });
}

export async function createOrUpdateFaculty(facultyData) {
    return await database.faculty().updateOne(
        { email: facultyData.email },
        { 
            $set: {
                ...facultyData,
                updatedAt: new Date()
            }
        },
        { upsert: true }
    );
}

export async function createBooking(bookingData) {
    return await database.bookings().insertOne({
        ...bookingData,
        createdAt: new Date(),
        status: 'pending'
    });
}

export async function findBookingsByFaculty(facultyEmail) {
    return await database.bookings()
        .find({ 
            facultyEmail,
            status: { $ne: 'cancelled' }
        })
        .sort({ date: 1, startTime: 1 })
        .toArray();
}

export async function checkOverlappingBookings(roomType, date, startTime, endTime) {
    return await database.bookings().findOne({
        roomType,
        date,
        status: { $ne: 'cancelled' },
        $or: [
            {
                startTime: { $lt: endTime },
                endTime: { $gt: startTime }
            }
        ]
    });
}

export async function cancelBooking(bookingId) {
    return await database.bookings().updateOne(
        { _id: new ObjectId(bookingId) },
        { 
            $set: { 
                status: 'cancelled',
                cancelledAt: new Date()
            }
        }
    );
}